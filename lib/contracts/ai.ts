import type { ImageMimeType } from "./chat";
import type { Grade } from "./grade";

/** Contrato del servicio de IA. Fuente de verdad: tasks.md, sección 6.2. */

/** T-050: imagen ya validada por `chatImageSchema`, lista para pasar a un proveedor. Ver tasks.md 6.7. */
export interface TutorImage {
  mediaType: ImageMimeType;
  data: string;
}

export interface TutorTurn {
  role: "user" | "assistant";
  content: string;
  /** Solo el turno más reciente la trae en la práctica. */
  images?: TutorImage[];
}

export interface TutorReplyInput {
  sessionId: string;
  /** Nivel K-12 de la alumna: adapta el prompt de sistema (`buildSystemPrompt`). Sin él, 6.º grado. */
  grade?: Grade;
  /** Ya recortado por slidingWindow; solo texto, nunca bloques de thinking. */
  messages: TutorTurn[];
  signal?: AbortSignal;
}

export interface TutorUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export type StopReason = "end_turn" | "max_tokens" | "refusal" | "error";

export interface TutorReplyDone {
  usage: TutorUsage;
  model: string;
  stopReason: StopReason;
  latencyMs: number;
  ttfbMs: number;
}

export interface TutorReplyResult {
  /** Deltas de texto. */
  stream: ReadableStream<string>;
  done: Promise<TutorReplyDone>;
}

export type ProviderName = "anthropic" | "openrouter" | "mock";

export interface TutorProvider {
  readonly name: ProviderName;
  readonly model: string;
  /** T-051: modelo que se usa en vez de `model` cuando el turno más reciente trae imágenes (solo OpenRouter; Anthropic ya es multimodal con el mismo modelo). */
  readonly visionModel?: string;
  reply(input: TutorReplyInput): Promise<TutorReplyResult>;
}

/** True si el turno más reciente trae al menos una imagen. */
export function inputHasImage(input: Pick<TutorReplyInput, "messages">): boolean {
  return Boolean(input.messages.at(-1)?.images?.length);
}

/** Modelo que efectivamente atenderá la petición: `visionModel` si hay imagen y el proveedor lo define, si no `model`. */
export function modelForRequest(provider: TutorProvider, input: Pick<TutorReplyInput, "messages">): string {
  return inputHasImage(input) && provider.visionModel ? provider.visionModel : provider.model;
}
