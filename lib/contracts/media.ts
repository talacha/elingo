import { z } from "zod";

/**
 * Contratos de voz: transcripción (entrada) y síntesis (salida). Fuente de verdad: tasks.md 6.8-6.9.
 * Ninguno persiste audio; ambos degradan a `null`/`204` cuando falta la clave del proveedor.
 */

/** ~1.5 MB en base64: de sobra para una pregunta hablada de unos segundos. */
export const MAX_TRANSCRIBE_AUDIO_BASE64_CHARS = 2_000_000;

export const transcribeRequestSchema = z.object({
  /** Base64 sin el prefijo `data:...;base64,`, tal cual lo entrega `MediaRecorder`. */
  audio: z.string().min(1).max(MAX_TRANSCRIBE_AUDIO_BASE64_CHARS),
  /** Por ejemplo `audio/webm`. */
  mimeType: z.string().min(1),
});
export type TranscribeRequest = z.infer<typeof transcribeRequestSchema>;

export interface TranscribeResponse {
  text: string;
}

/** Las respuestas de ELI no deberían superar esto; evita sintetizar texto desmedido. */
export const MAX_SPEECH_INPUT_CHARS = 2000;

export const speechRequestSchema = z.object({
  text: z.string().min(1).max(MAX_SPEECH_INPUT_CHARS),
});
export type SpeechRequest = z.infer<typeof speechRequestSchema>;
