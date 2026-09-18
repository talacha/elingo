import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import type { ChatMessage, Subject } from "@/lib/contracts/chat";
import type { SessionDetailResponse, SessionSummary } from "@/lib/contracts/sessions";
import { createDb, type Db } from "./client";
import {
  aggregateSubjectInsights,
  MAX_SESSIONS,
  type AdminUserSummary,
  type NewMessage,
  type Repo,
  type RepoScope,
  type SubjectInsight,
  type SupabaseUserInput,
  type UpsertSessionInput,
  type UserFlags,
  type UserRecord,
  type UserSecurity,
} from "./repo";
import {
  appConfig,
  chatSessions,
  messages,
  users,
  type ChatSessionRow,
  type MessageRow,
  type UserRow,
} from "./schema";

/**
 * Repositorio sobre Neon (Postgres) vía HTTP. Cada método es una sola sentencia atómica
 * (upsert / insert ... on conflict), así que no necesita transacciones.
 */
export class NeonRepo implements Repo {
  readonly kind = "neon" as const;
  /** Expuesto para scripts y tests (limpieza); el resto de la app usa la interfaz Repo. */
  readonly db: Db;

  constructor(databaseUrl: string) {
    this.db = createDb(databaseUrl);
  }

  async upsertSession(input: UpsertSessionInput): Promise<SessionSummary> {
    const [row] = await this.db
      .insert(chatSessions)
      .values({
        id: input.id,
        userId: input.userId ?? null,
        anonId: input.anonId ?? null,
        subject: input.subject ?? null,
        title: input.title ?? null,
      })
      .onConflictDoUpdate({
        target: chatSessions.id,
        set: {
          // La propiedad no cambia una vez fijada; solo se rellena si estaba vacía.
          userId: sql`coalesce(${chatSessions.userId}, excluded.user_id)`,
          anonId: sql`coalesce(${chatSessions.anonId}, excluded.anon_id)`,
          subject: sql`coalesce(excluded.subject, ${chatSessions.subject})`,
          title: sql`coalesce(excluded.title, ${chatSessions.title})`,
          updatedAt: sql`now()`,
        },
      })
      .returning();
    return toSummary(row);
  }

  async insertMessages(input: NewMessage[]): Promise<number> {
    if (input.length === 0) return 0;
    const base = Date.now();
    const inserted = await this.db
      .insert(messages)
      .values(
        input.map((m, i) => ({
          id: m.id,
          sessionId: m.sessionId,
          role: m.role,
          content: m.content,
          tokensIn: m.tokensIn ?? null,
          tokensOut: m.tokensOut ?? null,
          model: m.model ?? null,
          createdAt: m.createdAt ? new Date(m.createdAt) : new Date(base + i),
        })),
      )
      .onConflictDoNothing({ target: messages.id })
      .returning({ id: messages.id });
    return inserted.length;
  }

  async listSessions(scope: RepoScope): Promise<SessionSummary[]> {
    const rows = await this.db
      .select()
      .from(chatSessions)
      .where(scopeWhere(scope))
      .orderBy(desc(chatSessions.updatedAt), desc(chatSessions.createdAt))
      .limit(MAX_SESSIONS);
    return rows.map(toSummary);
  }

  async getSession(id: string, scope: RepoScope): Promise<SessionDetailResponse | null> {
    const [session] = await this.db
      .select()
      .from(chatSessions)
      .where(and(eq(chatSessions.id, id), scopeWhere(scope)))
      .limit(1);
    if (!session) return null;
    const rows = await this.db
      .select()
      .from(messages)
      .where(and(eq(messages.sessionId, id), inArray(messages.role, ["user", "assistant"])))
      .orderBy(messages.createdAt);
    return { session: toSummary(session), messages: rows.flatMap(toChatMessage) };
  }

  async upsertUserFromSupabase(input: SupabaseUserInput): Promise<UserRecord> {
    const [row] = await this.db
      .insert(users)
      .values({
        supabaseUserId: input.supabaseUserId,
        displayName: input.displayName ?? null,
        ...(input.role ? { role: input.role } : {}),
        ...(input.grade ? { grade: input.grade } : {}),
      })
      .onConflictDoUpdate({
        target: users.supabaseUserId,
        set: {
          // Siempre hay algo que actualizar para que RETURNING devuelva también la fila existente.
          supabaseUserId: sql`excluded.supabase_user_id`,
          ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
          ...(input.role ? { role: input.role } : {}),
          ...(input.grade ? { grade: input.grade } : {}),
        },
      })
      .returning();
    return toUser(row);
  }

  async getUserSecurity(userId: string): Promise<UserSecurity | null> {
    const [row] = await this.db
      .select({
        safeWordHash: users.safeWordHash,
        allowImages: users.allowImages,
        allowVoice: users.allowVoice,
        allowText: users.allowText,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return row ?? null;
  }

  async setSafeWordHash(userId: string, hash: string): Promise<void> {
    await this.db.update(users).set({ safeWordHash: hash }).where(eq(users.id, userId));
  }

  async updateUserFlags(userId: string, patch: Partial<UserFlags>): Promise<UserFlags> {
    const [row] = await this.db
      .update(users)
      .set(patch)
      .where(eq(users.id, userId))
      .returning({
        allowImages: users.allowImages,
        allowVoice: users.allowVoice,
        allowText: users.allowText,
      });
    if (!row) throw new Error(`users: el usuario ${userId} no existe`);
    return row;
  }

  async getSubjectInsights(userId: string): Promise<SubjectInsight[]> {
    const rows = await this.db
      .select({
        subject: chatSessions.subject,
        sessionId: chatSessions.id,
        role: messages.role,
        content: messages.content,
        createdAt: messages.createdAt,
      })
      .from(chatSessions)
      .innerJoin(messages, eq(messages.sessionId, chatSessions.id))
      .where(and(eq(chatSessions.userId, userId), isNotNull(chatSessions.subject)));
    return aggregateSubjectInsights(
      rows.map((r) => ({ ...r, subject: r.subject as Subject, createdAt: r.createdAt.toISOString() })),
    );
  }

  async listAllUsers(): Promise<AdminUserSummary[]> {
    const rows = await this.db
      .select({
        id: users.id,
        displayName: users.displayName,
        role: users.role,
        createdAt: users.createdAt,
        sessionCount: sql<number>`count(${chatSessions.id})::int`,
      })
      .from(users)
      .leftJoin(chatSessions, eq(chatSessions.userId, users.id))
      .groupBy(users.id)
      .orderBy(desc(users.createdAt));
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  }

  async getAiConfig(): Promise<Record<string, string>> {
    const rows = await this.db.select({ key: appConfig.key, value: appConfig.value }).from(appConfig);
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  async setAiConfig(key: string, value: string, updatedBy: string): Promise<void> {
    await this.db
      .insert(appConfig)
      .values({ key, value, updatedBy })
      .onConflictDoUpdate({ target: appConfig.key, set: { value, updatedBy, updatedAt: sql`now()` } });
  }
}

function scopeWhere(scope: RepoScope) {
  if (scope.userId) return eq(chatSessions.userId, scope.userId);
  if (scope.anonId) return eq(chatSessions.anonId, scope.anonId);
  throw new Error("RepoScope vacío: hace falta userId o anonId");
}

function toSummary(row: ChatSessionRow): SessionSummary {
  return {
    id: row.id,
    title: row.title,
    subject: row.subject,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Los mensajes `system` no forman parte del historial visible (contrato 6.4). */
function toChatMessage(row: MessageRow): ChatMessage[] {
  if (row.role === "system") return [];
  return [
    { id: row.id, role: row.role, content: row.content, createdAt: row.createdAt.toISOString() },
  ];
}

function toUser(row: UserRow): UserRecord {
  return {
    id: row.id,
    supabaseUserId: row.supabaseUserId,
    displayName: row.displayName,
    grade: row.grade,
    role: row.role,
    createdAt: row.createdAt.toISOString(),
  };
}
