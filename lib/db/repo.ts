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
  /** Hash de la palabra segura (lib/auth/safeword.ts); null = no configurada. Nunca texto plano. */
  safeWordHash: string | null;
  createdAt: string;
}

export interface AppSetting {
  key: string;
  value: string;
  updatedAt: string;
  updatedBy: string | null;
}

export type RepoKind = "neon" | "memory";

/** Máximo de conversaciones que devuelve listSessions (las más recientes). */
export const MAX_SESSIONS = 50;

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
  /** Por id de Neon (no el de Supabase); null si no existe. */
  getUserById(id: string): Promise<UserRecord | null>;
  /** Guarda (o borra con null) el hash de la palabra segura del padre/madre. */
  setSafeWordHash(userId: string, hash: string | null): Promise<void>;
  /** Todas las cuentas con fila en Neon, para /admin. No incluye sesiones puramente anónimas. */
  listUsers(): Promise<UserRecord[]>;
  /** Ajuste guardado en app_settings; null si no está puesto (se usa el valor por defecto de la env var). */
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string, updatedBy?: string): Promise<void>;
  listSettings(): Promise<AppSetting[]>;
}
