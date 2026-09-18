import Anthropic from "@anthropic-ai/sdk";
import { ELI_SYSTEM_PROMPT } from "@/lib/ai/prompt";
import {
  createTutorStream,
  ZERO_USAGE,
  type TutorOutcome,
  type TutorStreamHandle,
} from "@/lib/ai/providers/stream";
import { subjectHint } from "@/lib/ai/subjects";
import type {
  StopReason,
  TutorProvider,
  TutorReplyInput,
  TutorReplyResult,
  TutorUsage,
} from "@/lib/contracts/ai";
import type { Subject } from "@/lib/contracts/chat";
import { getEnv, type Env } from "@/lib/env";

/** Beta del SDK que activa `fallbacks`: modelo de respaldo cuando el principal rehúsa. */
export const FALLBACK_BETA = "server-side-fallback-2026-06-01";

export interface AnthropicProviderOptions {
  /** Cliente inyectable (tests). Por defecto `new Anthropic()`, que lee `ANTHROPIC_API_KEY`. */
  client?: Anthropic;
  env?: Env;
}

/** Lo que el proveedor necesita de un `Message` o `BetaMessage` del SDK. */
export interface UpstreamMessage {
  model: string;
  stop_reason: string | null;
  usage: UpstreamUsage;
}

export interface UpstreamUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number | null;
  cache_creation_input_tokens: number | null;
}

/** Lo que el proveedor usa de `MessageStream` y `BetaMessageStream` (misma superficie). */
interface UpstreamStream {
  on(event: "text", listener: (delta: string) => void): unknown;
  on(event: "streamEvent", listener: (event: unknown, snapshot: UpstreamMessage) => void): unknown;
  finalMessage(): Promise<UpstreamMessage>;
}

export interface SystemBlock {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" };
}

/**
 * Proveedor principal: Anthropic API con el SDK oficial y `claude-fable-5-1` (contrato 6.2).
 *
 * - `client.messages.stream` con el prompt de sistema literal cacheado (`cache_control`),
 *   `output_config.effort` (low por defecto) y sin `temperature` ni `thinking`: Fable 5.1 los rechaza.
 * - Con `ANTHROPIC_FALLBACK_MODEL`, la misma petición va por `client.beta.messages.stream` con la
 *   beta de fallbacks; `done.model` es entonces el modelo que respondió de verdad.
 * - `stop_reason` se mapea a `end_turn | max_tokens | refusal`; los errores tipados del SDK y
 *   cualquier otro fallo acaban en `stopReason: "error"` (con el uso parcial conocido) y un mensaje
 *   amable en el stream. `done` nunca rechaza.
 */
export class AnthropicProvider implements TutorProvider {
  readonly name = "anthropic" as const;
  readonly model: string;
  readonly fallbackModel: string | undefined;
  private readonly client: Anthropic;
  private readonly effort: Env["ANTHROPIC_EFFORT"];
  private readonly maxOutputTokens: number;

  constructor(options: AnthropicProviderOptions = {}) {
    const env = options.env ?? getEnv();
    this.client = options.client ?? new Anthropic();
    this.model = env.ANTHROPIC_MODEL;
    this.fallbackModel = env.ANTHROPIC_FALLBACK_MODEL;
    this.effort = env.ANTHROPIC_EFFORT;
    this.maxOutputTokens = env.AI_MAX_OUTPUT_TOKENS;
  }

  async reply(input: TutorReplyInput): Promise<TutorReplyResult> {
    return createTutorStream({
      provider: this.name,
      model: this.model,
      signal: input.signal,
      produce: (handle) => this.produce(input, handle),
    });
  }

  private async produce(input: TutorReplyInput, handle: TutorStreamHandle): Promise<TutorOutcome> {
    const upstream = this.open(input, handle.signal);
    let snapshot: UpstreamMessage | undefined;
    upstream.on("text", (delta) => handle.emit(delta));
    upstream.on("streamEvent", (_event, current) => {
      snapshot = current;
    });
    try {
      const final = await upstream.finalMessage();
      return {
        usage: toUsage(final.usage),
        model: final.model,
        stopReason: toStopReason(final.stop_reason),
      };
    } catch (error) {
      // Petición abortada, límite de peticiones, caída… El uso parcial (message_start/message_delta)
      // permite contabilizar lo ya gastado.
      return {
        usage: snapshot ? toUsage(snapshot.usage) : { ...ZERO_USAGE },
        model: snapshot?.model ?? this.model,
        stopReason: "error",
        error,
      };
    }
  }

  private open(input: TutorReplyInput, signal: AbortSignal): UpstreamStream {
    const base = {
      model: this.model,
      max_tokens: this.maxOutputTokens,
      system: buildSystem(input.subject),
      output_config: { effort: this.effort },
      messages: input.messages.map(({ role, content }) => ({ role, content })),
    };
    if (this.fallbackModel) {
      return this.client.beta.messages.stream(
        { ...base, betas: [FALLBACK_BETA], fallbacks: [{ model: this.fallbackModel }] },
        { signal },
      );
    }
    return this.client.messages.stream(base, { signal });
  }
}

/**
 * Bloques de sistema: primero el prompt literal con `cache_control` (prefijo estable) y, si hay
 * asignatura, un segundo bloque sin caché que no invalida el primero.
 */
export function buildSystem(subject?: Subject): SystemBlock[] {
  const blocks: SystemBlock[] = [
    { type: "text", text: ELI_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
  ];
  const hint = subjectHint(subject);
  if (hint) blocks.push({ type: "text", text: hint });
  return blocks;
}

export function toUsage(usage: UpstreamUsage): TutorUsage {
  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
  };
}

/** `end_turn`, `max_tokens` y `refusal` tal cual; el resto (sin herramientas ni stop sequences) cuenta como turno terminado. */
export function toStopReason(raw: string | null): StopReason {
  switch (raw) {
    case "max_tokens":
    case "model_context_window_exceeded":
      return "max_tokens";
    case "refusal":
      return "refusal";
    default:
      return "end_turn";
  }
}
