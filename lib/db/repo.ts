import { asksForTheAnswer } from "@/lib/ai/providers/mock";
import type { Subject } from "@/lib/contracts/chat";
import type { SessionDetailResponse, SessionSummary } from "@/lib/contracts/sessions";
import type { MessageRole, UserRole } from "./schema";

/**
 * Interfaz del repositorio (tasks.md, sección 6.5). Dos implementaciones con la misma semántica:
 * NeonRepo (lib/db/neon.ts) con DATABASE_URL y MemoryRepo (lib/db/memory.ts) sin ella.
 * `getRepo()` (lib/db/index.ts) elige según el entorno.
 */

/**
 * Ámbito de acceso a las conversaciones: `userId` (sesión de Supabase, T-032) tiene prioridad
 * sobre `anonId` (cookie eli_anon). Sin ninguno de los dos el repositorio lanza un error.
 */
export interface RepoScope {
  userId?: string;
  anonId?: string;
}

export interface UpsertSessionInput {
  /** uuid generado por el cliente (ChatRequest.sessionId). */
  id: string;
  userId?: string;
  anonId?: string;
  subject?: Subject;
  /** Lo deriva quien persiste (p. ej. del primer mensaje de la alumna); nunca se pisa con vacío. */
  title?: string;
}

export interface NewMessage {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  tokensIn?: number;
  tokensOut?: number;
  model?: string;
  /**
   * ISO 8601 o Date. Si falta, se asigna en orden de llegada (misma base + índice) para que el
   * historial conserve el orden aunque varios mensajes entren en la misma sentencia.
   */
  createdAt?: string | Date;
}

export interface SupabaseUserInput {
  supabaseUserId: string;
  displayName?: string;
  role?: UserRole;
  grade?: string;
}

export interface UserRecord {
  id: string;
  supabaseUserId: string | null;
  displayName: string | null;
  grade: string;
  role: UserRole;
  createdAt: string;
}

export type RepoKind = "neon" | "memory";

/** Máximo de conversaciones que devuelve listSessions (las más recientes). */
export const MAX_SESSIONS = 50;

/** M7: los tres interruptores que un padre/madre controla desde /parents (tasks.md 6.11). */
export interface UserFlags {
  allowImages: boolean;
  allowVoice: boolean;
  allowText: boolean;
}

export interface UserSecurity extends UserFlags {
  safeWordHash: string | null;
}

export interface SubjectInsight {
  subject: Subject;
  sessionCount: number;
  messageCount: number;
  /** Veces que un mensaje de la alumna coincidió con el heurístico "pide la respuesta". */
  answerRequests: number;
  lastActivity: string | null;
}

export interface AdminUserSummary {
  id: string;
  displayName: string | null;
  role: UserRole;
  createdAt: string;
  sessionCount: number;
}

/** Fila cruda (sesión × mensaje) de la que se derivan los SubjectInsight; ver `aggregateSubjectInsights`. */
export interface SubjectInsightRow {
  subject: Subject;
  sessionId: string;
  role: MessageRole;
  content: string;
  createdAt: string;
}

/**
 * Agrega filas crudas de sesión/mensaje en `SubjectInsight[]` por asignatura. Pura y compartida por
 * `NeonRepo`/`MemoryRepo` (tasks.md 6.11): cada una trae sus propias filas con su propio acceso a
 * datos, pero la aritmética y el heurístico de "pide la respuesta" viven en un solo sitio.
 */
export function aggregateSubjectInsights(rows: readonly SubjectInsightRow[]): SubjectInsight[] {
  interface Bucket {
    sessions: Set<string>;
    messages: number;
    answerRequests: number;
    lastActivity: string | null;
  }
  const bySubject = new Map<Subject, Bucket>();
  for (const row of rows) {
    const bucket = bySubject.get(row.subject) ?? {
      sessions: new Set<string>(),
      messages: 0,
      answerRequests: 0,
      lastActivity: null,
    };
    bucket.sessions.add(row.sessionId);
    if (row.role !== "system") bucket.messages += 1;
    if (row.role === "user" && asksForTheAnswer(row.content)) bucket.answerRequests += 1;
    if (!bucket.lastActivity || row.createdAt > bucket.lastActivity) bucket.lastActivity = row.createdAt;
    bySubject.set(row.subject, bucket);
  }
  return [...bySubject.entries()]
    .map(([subject, b]) => ({
      subject,
      sessionCount: b.sessions.size,
      messageCount: b.messages,
      answerRequests: b.answerRequests,
      lastActivity: b.lastActivity,
    }))
    .sort((a, b) => (b.lastActivity ?? "").localeCompare(a.lastActivity ?? ""));
}

export interface Repo {
  /** Para /api/health (T-042): `db: "neon" | "memory"`. */
  readonly kind: RepoKind;
  /**
   * Crea la conversación o, si ya existe, refresca updated_at, subject y title (idempotente por id).
   * La propiedad (userId/anonId) no cambia una vez fijada; solo se rellena si estaba vacía.
   */
  upsertSession(input: UpsertSessionInput): Promise<SessionSummary>;
  /** Inserta con `on conflict do nothing`; devuelve cuántos mensajes eran nuevos. Falla si la sesión no existe. */
  insertMessages(input: NewMessage[]): Promise<number>;
  /** Conversaciones del ámbito, la más reciente primero (máximo MAX_SESSIONS). */
  listSessions(scope: RepoScope): Promise<SessionSummary[]>;
  /** Conversación con su historial visible (user/assistant, nunca system); null si no existe o no es del ámbito. */
  getSession(id: string, scope: RepoScope): Promise<SessionDetailResponse | null>;
  /** Crea o actualiza el usuario ligado a Supabase (T-032); solo actualiza los campos que llegan. */
  upsertUserFromSupabase(input: SupabaseUserInput): Promise<UserRecord>;

  /** M7: palabra segura + flags; null si el usuario no existe. */
  getUserSecurity(userId: string): Promise<UserSecurity | null>;
  /** M7: fija/cambia el hash (ya calculado por `lib/auth/safeWord.ts`; el repo nunca hashea). */
  setSafeWordHash(userId: string, hash: string): Promise<void>;
  /** M7: actualiza solo los flags que llegan; devuelve el estado final de los tres. */
  updateUserFlags(userId: string, patch: Partial<UserFlags>): Promise<UserFlags>;
  /** M7: informe por asignatura del usuario, derivado de sus propias sesiones/mensajes. */
  getSubjectInsights(userId: string): Promise<SubjectInsight[]>;
  /** M7 admin: todas las cuentas, más reciente primero. */
  listAllUsers(): Promise<AdminUserSummary[]>;
  /** M7 admin: overrides activos de `app_config` (vacío = todo por env vars). */
  getAiConfig(): Promise<Record<string, string>>;
  /** M7 admin: guarda un override; `updatedBy` es el email del admin, para auditoría. */
  setAiConfig(key: string, value: string, updatedBy: string): Promise<void>;
}
