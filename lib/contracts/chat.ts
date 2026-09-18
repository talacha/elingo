import { z } from "zod";

/** Contrato de POST /api/chat. Fuente de verdad: tasks.md, sección 6.1. */
export const SUBJECTS = ["mates", "lengua", "ciencias"] as const;
export type Subject = (typeof SUBJECTS)[number];

export const chatMessageSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  createdAt: z.string().optional(),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const chatRequestSchema = z.object({
  sessionId: z.string().uuid(),
  subject: z.enum(SUBJECTS).optional(),
  messages: z.array(chatMessageSchema).min(1),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;

export type ChatErrorCode =
  | "invalid_request"
  | "rate_limited"
  | "budget_exhausted"
  | "unauthorized"
  | "upstream_error";

export interface ChatError {
  error: ChatErrorCode;
  /** Amable, en español, apto para mostrar a la niña. */
  message: string;
  /** Segundos hasta poder reintentar (solo rate_limited). */
  retryAfter?: number;
  /** Detalle de validación (solo invalid_request). */
  issues?: unknown;
}

/** Cabeceras de la respuesta 200 (text/plain en streaming). */
export const CHAT_HEADERS = {
  sessionId: "x-session-id",
  provider: "x-provider",
  model: "x-model",
} as const;

/** Cookie anónima que identifica a la usuaria sin cuenta. */
export const ANON_COOKIE = "eli_anon";
