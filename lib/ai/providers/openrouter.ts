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
  TutorTurn,
  TutorUsage,
} from "@/lib/contracts/ai";
import type { Subject } from "@/lib/contracts/chat";
import { getEnv, type Env } from "@/lib/env";

/** Parte de contenido multimodal (formato compatible OpenAI que usa OpenRouter). */
interface OpenRouterContentPart {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string };
}
type OpenRouterContent = string | OpenRouterContentPart[];

export interface OpenRouterProviderOptions {
  env?: Env;
}

/** Respuesta SSE de OpenRouter: cada línea es un evento. */
interface OpenRouterSSEEvent {
  choices: Array<{
    delta: {
      content?: string;
    };
    finish_reason?: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
}

/**
 * Proveedor OpenRouter (tasks.md 6.2, T-019).
 *
 * - Usa `fetch` a `https://openrouter.ai/api/v1/chat/completions` con `stream: true`.
 * - Parsea la respuesta SSE, extrayendo deltas de `choices[0].delta.content`.
 * - Captura `usage` del chunk final (solicitado via `usage: { include: true }`).
 * - Encabezados: `Authorization: Bearer ${OPENROUTER_API_KEY}`, `HTTP-Referer`, `X-Title`.
 * - Mapea `finish_reason` a `end_turn | max_tokens | refusal | error`.
 * - Implementa el mismo contrato `TutorProvider` que Anthropic y Mock.
 * - T-051: si el turno más reciente trae imágenes, la petición usa `visionModel`
 *   (`OPENROUTER_VISION_MODEL`) en vez de `model`, con `content` como array multimodal
 *   (`image_url` con `data:` URI + `text`). Con `fallbackModel` configurado, un fallo *antes*
 *   de emitir ningún texto (`!handle.emitted`) reintenta una vez con ese modelo — nunca en
 *   peticiones con imagen: el modelo de respaldo no tiene por qué ser multimodal.
 */
export class OpenRouterProvider implements TutorProvider {
  readonly name = "openrouter" as const;
  readonly model: string;
  readonly visionModel: string;
  private readonly fallbackModel: string | undefined;
  private readonly apiKey: string;
  private readonly appUrl: string;
  private readonly maxOutputTokens: number;

  constructor(options: OpenRouterProviderOptions = {}) {
    const env = options.env ?? getEnv();
    this.model = env.OPENROUTER_MODEL;
    this.visionModel = env.OPENROUTER_VISION_MODEL;
    this.fallbackModel = env.OPENROUTER_FALLBACK_MODEL;
    this.apiKey = env.OPENROUTER_API_KEY || "";
    this.appUrl = env.NEXT_PUBLIC_APP_URL;
    this.maxOutputTokens = env.AI_MAX_OUTPUT_TOKENS;
  }

  async reply(input: TutorReplyInput): Promise<TutorReplyResult> {
    const hasImage = inputHasImage(input);
    return createTutorStream({
      provider: this.name,
      model: hasImage ? this.visionModel : this.model,
      signal: input.signal,
      produce: (handle) => this.produce(input, handle, hasImage),
    });
  }

  private async produce(
    input: TutorReplyInput,
    handle: TutorStreamHandle,
    hasImage: boolean,
  ): Promise<TutorOutcome> {
    const primaryModel = hasImage ? this.visionModel : this.model;
    const outcome = await this.attempt(primaryModel, input, handle);
    const canFallback = !hasImage && this.fallbackModel && this.fallbackModel !== primaryModel;
    if (outcome.stopReason === "error" && !handle.emitted && canFallback) {
      return this.attempt(this.fallbackModel as string, input, handle);
    }
    return outcome;
  }

  private async attempt(
    model: string,
    input: TutorReplyInput,
    handle: TutorStreamHandle,
  ): Promise<TutorOutcome> {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "HTTP-Referer": this.appUrl,
          "X-Title": "ELI",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: this.maxOutputTokens,
          stream: true,
          messages: buildMessages(input.subject, input.messages),
          usage: { include: true },
        }),
        signal: handle.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API error ${response.status}: ${errorText}`);
      }

      if (!response.body) {
        throw new Error("OpenRouter response has no body");
      }

      let usage: TutorUsage = { ...ZERO_USAGE };
      let stopReason: StopReason = "end_turn";
      let error: unknown | undefined;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        for (;;) {
          if (handle.signal.aborted) break;
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;

            const data = line.slice(6).trim();
            if (!data || data === "[DONE]") continue;

            try {
              const event = JSON.parse(data) as OpenRouterSSEEvent;
              processSSEEvent(event, handle, (u) => {
                usage = u;
              });

              if (event.choices?.[0]?.finish_reason) {
                stopReason = toStopReason(event.choices[0].finish_reason);
              }
            } catch (parseError) {
              console.error("[ai/openrouter] SSE parse error", { line, parseError });
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      if (handle.signal.aborted) {
        stopReason = "error";
      }

      return { usage, model, stopReason, error };
    } catch (error) {
      return { usage: { ...ZERO_USAGE }, model, stopReason: "error", error };
    }
  }
}

function inputHasImage(input: Pick<TutorReplyInput, "messages">): boolean {
  return Boolean(input.messages.at(-1)?.images?.length);
}

/**
 * Construye los mensajes con el prompt de sistema literal cacheado y pista de asignatura.
 * Un turno con imágenes se envía como `content` multimodal (formato compatible OpenAI).
 */
function buildMessages(subject: Subject | undefined, turns: readonly TutorTurn[]) {
  const messages: Array<{
    role: "user" | "assistant" | "system";
    content: OpenRouterContent;
  }> = [
    {
      role: "system",
      content: ELI_SYSTEM_PROMPT,
    },
  ];

  const hint = subjectHint(subject);
  if (hint) {
    messages.push({
      role: "system",
      content: hint,
    });
  }

  messages.push(...turns.map(toOpenRouterMessage));

  return messages;
}

function toOpenRouterMessage(turn: TutorTurn): { role: "user" | "assistant"; content: OpenRouterContent } {
  if (!turn.images?.length) return { role: turn.role, content: turn.content };
  return {
    role: turn.role,
    content: [
      { type: "text", text: turn.content },
      ...turn.images.map(
        (image): OpenRouterContentPart => ({
          type: "image_url",
          image_url: { url: `data:${image.mediaType};base64,${image.data}` },
        }),
      ),
    ],
  };
}

/**
 * Procesa un evento SSE: emite deltas de texto y actualiza usage si está presente.
 */
function processSSEEvent(
  event: OpenRouterSSEEvent,
  handle: TutorStreamHandle,
  updateUsage: (usage: TutorUsage) => void,
): void {
  const delta = event.choices?.[0]?.delta?.content;
  if (delta) {
    handle.emit(delta);
  }

  if (event.usage) {
    updateUsage({
      inputTokens: event.usage.prompt_tokens,
      outputTokens: event.usage.completion_tokens,
      cacheReadTokens: event.usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: event.usage.cache_creation_input_tokens ?? 0,
    });
  }
}

/**
 * Mapea OpenRouter finish_reason a StopReason.
 * OpenRouter usa: `stop`, `length`, `content_filter`, etc.
 */
function toStopReason(reason: string | null): StopReason {
  if (!reason) return "end_turn";
  switch (reason.toLowerCase()) {
    case "length":
      return "max_tokens";
    case "content_filter":
      return "refusal";
    default:
      return "end_turn";
  }
}
