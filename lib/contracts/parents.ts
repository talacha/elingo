import { z } from "zod";
import type { Subject } from "./chat";

/**
 * Contratos de /parents (M7): palabra segura, ajustes (flags) e informes. Fuente de verdad:
 * tasks.md, sección 6.11. No hay cuentas de hijo/a separadas — un único perfil por familia.
 */

export const setSafeWordRequestSchema = z.object({
  safeWord: z.string().min(4).max(60),
});
export type SetSafeWordRequest = z.infer<typeof setSafeWordRequestSchema>;

export const unlockRequestSchema = z.object({
  safeWord: z.string().min(1).max(60),
});
export type UnlockRequest = z.infer<typeof unlockRequestSchema>;

export const parentSettingsSchema = z.object({
  allowImages: z.boolean().optional(),
  allowVoice: z.boolean().optional(),
  allowText: z.boolean().optional(),
});
export type ParentSettingsPatch = z.infer<typeof parentSettingsSchema>;

export interface ParentSettings {
  allowImages: boolean;
  allowVoice: boolean;
  allowText: boolean;
}

export interface SubjectInsight {
  subject: Subject;
  sessionCount: number;
  messageCount: number;
  /** Veces que un mensaje suyo coincidió con el heurístico "pide la respuesta". */
  answerRequests: number;
  lastActivity: string | null;
}

export interface ParentInsightsResponse {
  hasSafeWord: boolean;
  settings: ParentSettings;
  subjects: SubjectInsight[];
}

/** httpOnly, ~4h; ver lib/auth/parentUnlock.ts. */
export const PARENT_UNLOCK_COOKIE = "eli_parent_unlock";

export type ParentErrorCode = "invalid_request" | "unauthorized" | "needs_safe_word" | "upstream_error";

export interface ParentError {
  error: ParentErrorCode;
  /** Amable, en español. */
  message: string;
}
