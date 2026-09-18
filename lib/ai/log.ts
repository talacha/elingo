import type { TutorReplyDone } from "@/lib/contracts/ai";
import type { ProviderName } from "@/lib/env";

/**
 * Estructura del evento de chat para logging.
 * Sin contenido de mensajes ni datos personales para garantizar la privacidad.
 */
export interface ChatLogEvent {
  event: "chat";
  sessionId: string;
  provider: ProviderName;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  latencyMs: number;
  ttfbMs: number;
  stopReason: string;
}

/**
 * Emite exactamente una línea JSON de log por petición de chat, sin contenido de mensajes.
 * Apta para ser consumida por piping a `jq` o similares.
 *
 * @param event Datos del evento (sin PII)
 */
export function logChatEvent(event: ChatLogEvent): void {
  const logLine = JSON.stringify(event);
  console.log(logLine);
}

/**
 * Crea un evento de log a partir de la información de la petición y la respuesta.
 */
export function createChatLogEvent(
  sessionId: string,
  provider: ProviderName,
  done: TutorReplyDone,
): ChatLogEvent {
  return {
    event: "chat",
    sessionId,
    provider,
    model: done.model,
    inputTokens: done.usage.inputTokens,
    outputTokens: done.usage.outputTokens,
    cacheReadTokens: done.usage.cacheReadTokens,
    cacheWriteTokens: done.usage.cacheWriteTokens,
    latencyMs: done.latencyMs,
    ttfbMs: done.ttfbMs,
    stopReason: done.stopReason,
  };
}
