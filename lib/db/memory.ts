import type { ChatMessage, Subject } from "@/lib/contracts/chat";
import type { SessionDetailResponse, SessionSummary } from "@/lib/contracts/sessions";
import {
  MAX_SESSIONS,
  type AppSetting,
  type NewMessage,
  type Repo,
  type RepoScope,
  type SupabaseUserInput,
  type UpsertSessionInput,
  type UserRecord,
} from "./repo";
import type { MessageRole } from "./schema";

interface MemSession {
  id: string;
  userId: string | null;
  anonId: string | null;
  subject: Subject | null;
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
  private readonly users = new Map<string, UserRecord>();
  private readonly sessions = new Map<string, MemSession>();
  private readonly messages = new Map<string, MemMessage>();
  private readonly settings = new Map<string, AppSetting>();
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
          subject: input.subject ?? prev.subject,
          title: input.title ?? prev.title,
          updatedAt: t,
          seq: ++this.seq,
        }
      : {
          id: input.id,
          userId: input.userId ?? null,
          anonId: input.anonId ?? null,
          subject: input.subject ?? null,
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
    const row: UserRecord = prev
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
          safeWordHash: null,
          createdAt: new Date(this.now()).toISOString(),
        };
    this.users.set(row.id, row);
    return row;
  }

  async getUserById(id: string): Promise<UserRecord | null> {
    return this.users.get(id) ?? null;
  }

  async setSafeWordHash(userId: string, hash: string | null): Promise<void> {
    const prev = this.users.get(userId);
    if (!prev) throw new Error(`users: el usuario ${userId} no existe`);
    this.users.set(userId, { ...prev, safeWordHash: hash });
  }

  async listUsers(): Promise<UserRecord[]> {
    return [...this.users.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async getSetting(key: string): Promise<string | null> {
    return this.settings.get(key)?.value ?? null;
  }

  async setSetting(key: string, value: string, updatedBy?: string): Promise<void> {
    this.settings.set(key, {
      key,
      value,
      updatedAt: new Date(this.now()).toISOString(),
      updatedBy: updatedBy ?? null,
    });
  }

  async listSettings(): Promise<AppSetting[]> {
    return [...this.settings.values()].sort((a, b) => a.key.localeCompare(b.key));
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
    subject: s.subject,
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
