import type { ChatMessage } from "@/lib/contracts/chat";
import type { SessionDetailResponse, SessionSummary } from "@/lib/contracts/sessions";
import {
  ACCOUNT_FLAG_IMAGE,
  ACCOUNT_FLAG_VOICE,
  aggregateActivity,
  MAX_SESSIONS,
  type AdminUserSummary,
  type NewMessage,
  type Repo,
  type RepoScope,
  type ActivityInsight,
  type ActivityRow,
  type SupabaseUserInput,
  type UpsertSessionInput,
  type UserFlags,
  type UserRecord,
  type UserSecurity,
} from "./repo";
import type { MessageRole, UserRole } from "./schema";

/** M7: UserRecord más los campos que no expone el contrato público de upsertUserFromSupabase. */
interface MemUser extends UserRecord {
  safeWordHash: string | null;
  allowText: boolean;
}

interface MemSession {
  id: string;
  userId: string | null;
  anonId: string | null;
  title: string | null;
  createdAt: number;
  updatedAt: number;
  /** Desempate cuando dos filas comparten el mismo milisegundo. */
  seq: number;
}

interface MemMessage {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  tokensIn: number | null;
  tokensOut: number | null;
  model: string | null;
  createdAt: number;
  seq: number;
}

/**
 * Repositorio en memoria del proceso: fallback sin DATABASE_URL (dev, tests, CI).
 * Misma semántica que NeonRepo; no sobrevive a reinicios ni se comparte entre instancias.
 */
export class MemoryRepo implements Repo {
  readonly kind = "memory" as const;
  private readonly users = new Map<string, MemUser>();
  private readonly sessions = new Map<string, MemSession>();
  private readonly messages = new Map<string, MemMessage>();
  private readonly appConfigStore = new Map<string, string>();
  /** userId → (flag → enabled): solo los flags que se apartan del global. */
  private readonly accountFlagStore = new Map<string, Map<string, boolean>>();
  private seq = 0;

  constructor(private readonly now: () => number = Date.now) {}

  async upsertSession(input: UpsertSessionInput): Promise<SessionSummary> {
    const t = this.now();
    const prev = this.sessions.get(input.id);
    const row: MemSession = prev
      ? {
          ...prev,
          userId: prev.userId ?? input.userId ?? null,
          anonId: prev.anonId ?? input.anonId ?? null,
          title: input.title ?? prev.title,
          updatedAt: t,
          seq: ++this.seq,
        }
      : {
          id: input.id,
          userId: input.userId ?? null,
          anonId: input.anonId ?? null,
          title: input.title ?? null,
          createdAt: t,
          updatedAt: t,
          seq: ++this.seq,
        };
    this.sessions.set(row.id, row);
    return toSummary(row);
  }

  async insertMessages(input: NewMessage[]): Promise<number> {
    if (input.length === 0) return 0;
    for (const m of input) {
      if (!this.sessions.has(m.sessionId)) {
        throw new Error(`messages.session_id: la sesión ${m.sessionId} no existe`);
      }
    }
    const base = this.now();
    let inserted = 0;
    input.forEach((m, i) => {
      if (this.messages.has(m.id)) return;
      this.messages.set(m.id, {
        id: m.id,
        sessionId: m.sessionId,
        role: m.role,
        content: m.content,
        tokensIn: m.tokensIn ?? null,
        tokensOut: m.tokensOut ?? null,
        model: m.model ?? null,
        createdAt: m.createdAt ? new Date(m.createdAt).getTime() : base + i,
        seq: ++this.seq,
      });
      inserted += 1;
    });
    return inserted;
  }

  async listSessions(scope: RepoScope): Promise<SessionSummary[]> {
    const inScope = scopeFilter(scope);
    return [...this.sessions.values()]
      .filter(inScope)
      .sort((a, b) => b.updatedAt - a.updatedAt || b.seq - a.seq)
      .slice(0, MAX_SESSIONS)
      .map(toSummary);
  }

  async getSession(id: string, scope: RepoScope): Promise<SessionDetailResponse | null> {
    const inScope = scopeFilter(scope);
    const session = this.sessions.get(id);
    if (!session || !inScope(session)) return null;
    const history = [...this.messages.values()]
      .filter((m) => m.sessionId === id)
      .sort((a, b) => a.createdAt - b.createdAt || a.seq - b.seq)
      .flatMap(toChatMessage);
    return { session: toSummary(session), messages: history };
  }

  async upsertUserFromSupabase(input: SupabaseUserInput): Promise<UserRecord> {
    const prev = [...this.users.values()].find((u) => u.supabaseUserId === input.supabaseUserId);
    const row: MemUser = prev
      ? {
          ...prev,
          displayName: input.displayName ?? prev.displayName,
          role: input.role ?? prev.role,
          grade: input.grade ?? prev.grade,
        }
      : {
          id: crypto.randomUUID(),
          supabaseUserId: input.supabaseUserId,
          displayName: input.displayName ?? null,
          grade: input.grade ?? "6º",
          role: input.role ?? "student",
          createdAt: new Date(this.now()).toISOString(),
          safeWordHash: null,
          allowText: true,
        };
    this.users.set(row.id, row);
    return row;
  }

  async getUser(supabaseUserId: string): Promise<UserRecord | null> {
    const user = [...this.users.values()].find((u) => u.supabaseUserId === supabaseUserId);
    if (!user) return null;
    const { id, supabaseUserId: sId, displayName, grade, role, createdAt } = user;
    return { id, supabaseUserId: sId, displayName, grade, role, createdAt };
  }

  async getUserSecurity(userId: string): Promise<UserSecurity | null> {
    const user = this.users.get(userId);
    if (!user) return null;
    const flags = this.accountFlagStore.get(userId);
    return {
      safeWordHash: user.safeWordHash,
      allowText: user.allowText,
      allowImages: flags?.get(ACCOUNT_FLAG_IMAGE) ?? true,
      allowVoice: flags?.get(ACCOUNT_FLAG_VOICE) ?? true,
    };
  }

  async setSafeWordHash(userId: string, hash: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) throw new Error(`users: el usuario ${userId} no existe`);
    user.safeWordHash = hash;
  }

  async updateUserFlags(userId: string, patch: Partial<UserFlags>): Promise<UserFlags> {
    const user = this.users.get(userId);
    if (!user) throw new Error(`users: el usuario ${userId} no existe`);
    if (patch.allowText !== undefined) user.allowText = patch.allowText;
    if (patch.allowImages !== undefined) await this.setAccountFlag(userId, ACCOUNT_FLAG_IMAGE, patch.allowImages);
    if (patch.allowVoice !== undefined) await this.setAccountFlag(userId, ACCOUNT_FLAG_VOICE, patch.allowVoice);
    const { allowImages, allowVoice, allowText } = (await this.getUserSecurity(userId)) as UserSecurity;
    return { allowImages, allowVoice, allowText };
  }

  async getActivityInsight(userId: string): Promise<ActivityInsight> {
    const sessionIds = new Set([...this.sessions.values()].filter((s) => s.userId === userId).map((s) => s.id));
    const rows: ActivityRow[] = [...this.messages.values()]
      .filter((m) => sessionIds.has(m.sessionId))
      .map((m) => ({
        sessionId: m.sessionId,
        role: m.role,
        content: m.content,
        createdAt: new Date(m.createdAt).toISOString(),
      }));
    return aggregateActivity(rows);
  }

  async listAllUsers(): Promise<AdminUserSummary[]> {
    const sessionCountByUser = new Map<string, number>();
    for (const s of this.sessions.values()) {
      if (!s.userId) continue;
      sessionCountByUser.set(s.userId, (sessionCountByUser.get(s.userId) ?? 0) + 1);
    }
    return [...this.users.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((u) => ({
        id: u.id,
        displayName: u.displayName,
        role: u.role,
        createdAt: u.createdAt,
        sessionCount: sessionCountByUser.get(u.id) ?? 0,
        flagOverrides: Object.fromEntries(this.accountFlagStore.get(u.id) ?? []),
      }));
  }

  async setUserRole(userId: string, role: UserRole): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.role = role;
    }
  }

  async getAiConfig(): Promise<Record<string, string>> {
    return Object.fromEntries(this.appConfigStore);
  }

  async setAiConfig(key: string, value: string): Promise<void> {
    this.appConfigStore.set(key, value);
  }

  async deleteAiConfig(key: string): Promise<void> {
    this.appConfigStore.delete(key);
  }

  async getAccountFlags(userId: string): Promise<Record<string, boolean>> {
    return Object.fromEntries(this.accountFlagStore.get(userId) ?? []);
  }

  async setAccountFlag(userId: string, flag: string, enabled: boolean | null): Promise<void> {
    const flags = this.accountFlagStore.get(userId) ?? new Map<string, boolean>();
    if (enabled === null) flags.delete(flag);
    else flags.set(flag, enabled);
    this.accountFlagStore.set(userId, flags);
  }
}

function scopeFilter(scope: RepoScope): (s: MemSession) => boolean {
  if (scope.userId) {
    const userId = scope.userId;
    return (s) => s.userId === userId;
  }
  if (scope.anonId) {
    const anonId = scope.anonId;
    return (s) => s.anonId === anonId;
  }
  throw new Error("RepoScope vacío: hace falta userId o anonId");
}

function toSummary(s: MemSession): SessionSummary {
  return {
    id: s.id,
    title: s.title,
    updatedAt: new Date(s.updatedAt).toISOString(),
  };
}

/** Los mensajes `system` no forman parte del historial visible (contrato 6.4). */
function toChatMessage(m: MemMessage): ChatMessage[] {
  if (m.role === "system") return [];
  return [
    { id: m.id, role: m.role, content: m.content, createdAt: new Date(m.createdAt).toISOString() },
  ];
}
