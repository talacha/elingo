import { z } from "zod";

/** Contrato de POST /api/chat. Fuente de verdad: tasks.md, sección 6.1. */
export const SUBJECTS = ["mates", "lengua", "ciencias"] as const;
export type Subject = (typeof SUBJECTS)[number];

/** T-050: imagen adjunta a un mensaje (efímera, nunca se persiste). Fuente de verdad: tasks.md 6.7. */
export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type ImageMimeType = (typeof IMAGE_MIME_TYPES)[number];

/** ~1.1 MB de imagen ya comprimida en el cliente (T-055), en base64. */
export const MAX_IMAGE_BASE64_CHARS = 1_500_000;

export const chatImageSchema = z.object({
  mediaType: z.enum(IMAGE_MIME_TYPES),
  /** Base64 sin el prefijo `data:...;base64,`. */
  data: z.string().min(1).max(MAX_IMAGE_BASE64_CHARS),
});
export type ChatImage = z.infer<typeof chatImageSchema>;

export const chatMessageSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  createdAt: z.string().optional(),
  /** Solo relevante en el último mensaje (rol user); el texto sigue siendo obligatorio. */
  image: chatImageSchema.optional(),
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
