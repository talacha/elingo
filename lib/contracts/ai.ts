import type { Subject } from "./chat";

/** Contrato del servicio de IA. Fuente de verdad: tasks.md, sección 6.2. */
export interface TutorTurn {
  role: "user" | "assistant";
  content: string;
}

export interface TutorReplyInput {
  sessionId: string;
  subject?: Subject;
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
  reply(input: TutorReplyInput): Promise<TutorReplyResult>;
}
