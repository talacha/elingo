import { z } from "zod";
import { chatMessageSchema } from "./chat";
import type { ChatMessage } from "./chat";

/** Contrato de la cola de persistencia. Fuente de verdad: tasks.md, sección 6.3. */
export interface PersistedMessage extends ChatMessage {
  tokensIn?: number;
  tokensOut?: number;
  model?: string;
}

export interface PersistJob {
  sessionId: string;
  userId?: string;
  anonId?: string;
  /** Historial completo de la conversación; la persistencia es idempotente por message.id. */
  messages: PersistedMessage[];
}

/**
 * Valida el body de POST /api/jobs/persist. Ese endpoint recibe peticiones de red
 * (QStash, o directas si no hay firma configurada), así que su entrada no es de confianza.
 */
export const persistedMessageSchema = chatMessageSchema.extend({
  tokensIn: z.number().optional(),
  tokensOut: z.number().optional(),
  model: z.string().optional(),
});

export const persistJobSchema = z.object({
  sessionId: z.string().uuid(),
  userId: z.string().optional(),
  anonId: z.string().optional(),
  messages: z.array(persistedMessageSchema).min(1),
});
