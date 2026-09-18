import type { ChatMessage, Subject } from "./chat";

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
  subject?: Subject;
  /** Historial completo de la conversación; la persistencia es idempotente por message.id. */
  messages: PersistedMessage[];
}
