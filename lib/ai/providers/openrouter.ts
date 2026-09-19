import { buildSystemPrompt, REPLY_STYLE_HINT } from "@/lib/ai/prompt";
import {
  createTutorStream,
  ZERO_USAGE,
  type TutorOutcome,
  type TutorStreamHandle,
} from "@/lib/ai/providers/stream";
import { ReplyFilter } from "@/lib/ai/providers/replyFilter";
import type {
  StopReason,
  TutorProvider,
  TutorReplyInput,
  TutorReplyResult,
  TutorTurn,
  TutorUsage,
} from "@/lib/contracts/ai";
import type { Grade } from "@/lib/contracts/grade";
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
 *   (`image_url` con `data:` URI + `text`). Un fallo *antes* de emitir ningún texto
 *   (`!handle.emitted`) reintenta una vez con el modelo de respaldo: `fallbackModel` para texto y
 *   `visionFallbackModel` para fotos (uno aparte, porque el de texto podría no ver imágenes).
 */
export class OpenRouterProvider implements TutorProvider {
  readonly name = "openrouter" as const;
  readonly model: string;
  readonly visionModel: string;
  private readonly fallbackModel: string | undefined;
  private readonly visionFallbackModel: string | undefined;
  private readonly apiKey: string;
  private readonly appUrl: string;
  private readonly maxOutputTokens: number;
  private readonly firstTokenTimeoutMs: number;

  constructor(options: OpenRouterProviderOptions = {}) {
    const env = options.env ?? getEnv();
    this.model = env.OPENROUTER_MODEL;
    this.visionModel = env.OPENROUTER_VISION_MODEL;
    this.fallbackModel = env.OPENROUTER_FALLBACK_MODEL;
    this.visionFallbackModel = env.OPENROUTER_VISION_FALLBACK_MODEL;
    this.apiKey = env.OPENROUTER_API_KEY || "";
    this.appUrl = env.NEXT_PUBLIC_APP_URL;
    this.maxOutputTokens = env.AI_MAX_OUTPUT_TOKENS;
    this.firstTokenTimeoutMs = env.OPENROUTER_FIRST_TOKEN_TIMEOUT_MS;
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
    // Con foto el respaldo es SU PROPIO modelo (que acepta imágenes); nunca el de texto, que podría no verlas.
    const fallback = hasImage ? this.visionFallbackModel : this.fallbackModel;
    if (outcome.stopReason === "error" && !handle.emitted && fallback && fallback !== primaryModel) {
      return this.attempt(fallback, input, handle);
    }
    return outcome;
  }

  private async attempt(
    model: string,
    input: TutorReplyInput,
    handle: TutorStreamHandle,
  ): Promise<TutorOutcome> {
    // Un modelo gratuito saturado puede quedarse colgado sin contestar: si no llega texto visible a
    // tiempo se aborta este intento (y, con modelo de respaldo, se reintenta) en vez de agotar los
    // 60 s de la función y devolver un 504.
    const attemptAbort = new AbortController();
    const forwardAbort = () => attemptAbort.abort();
    if (handle.signal.aborted) attemptAbort.abort();
    else handle.signal.addEventListener("abort", forwardAbort, { once: true });
    const stallTimer = setTimeout(() => {
      console.error("[ai/openrouter] sin texto a tiempo, se aborta el intento", {
        model,
        afterMs: this.firstTokenTimeoutMs,
      });
      attemptAbort.abort();
    }, this.firstTokenTimeoutMs);
    const filter = new ReplyFilter();
    /** Emite lo que el filtro deja pasar; el primer texto visible desactiva el temporizador. */
    const emit = (delta: string) => {
      const visible = filter.push(delta);
      if (!visible) return;
      clearTimeout(stallTimer);
      handle.emit(visible);
    };

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
          messages: buildMessages(input.messages, input.grade),
          usage: { include: true },
          // Que el razonamiento de los modelos que lo separan no viaje en la respuesta.
          reasoning: { exclude: true },
        }),
        signal: attemptAbort.signal,
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
          if (attemptAbort.signal.aborted) break;
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
              processSSEEvent(event, emit, (u) => {
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

      const tail = filter.finish();
      if (tail) {
        clearTimeout(stallTimer);
        handle.emit(tail);
      }

      if (filter.leakedThinking) {
        // La respuesta era el razonamiento del modelo: nunca se enseña; cuenta como intento fallido.
        console.error("[ai/openrouter] la respuesta era razonamiento del modelo, se descarta", { model });
        return {
          usage,
          model,
          stopReason: "error",
          error: new Error("la respuesta contenía el razonamiento del modelo"),
        };
      }
      if (attemptAbort.signal.aborted) {
        stopReason = "error";
        error ??= new Error("el modelo no respondió a tiempo");
      }

      // Un 200 que termina sin ningún texto visible (p. ej. el modelo gastó todo su presupuesto en
      // razonamiento oculto) no es una respuesta: sin esto la niña recibiría un cuerpo vacío en vez del
      // modelo de respaldo o el aviso amable. Un rechazo (`refusal`) sí lleva su propio mensaje.
      if (!handle.emitted && !error && stopReason !== "refusal") {
        console.error("[ai/openrouter] el modelo terminó sin texto, se descarta", { model, stopReason });
        return { usage, model, stopReason: "error", error: new Error("el modelo terminó sin texto") };
      }

      return { usage, model, stopReason, error };
    } catch (error) {
      return { usage: { ...ZERO_USAGE }, model, stopReason: "error", error };
    } finally {
      clearTimeout(stallTimer);
      handle.signal.removeEventListener("abort", forwardAbort);
    }
  }
}

function inputHasImage(input: Pick<TutorReplyInput, "messages">): boolean {
  return Boolean(input.messages.at(-1)?.images?.length);
}

/**
 * Construye los mensajes con el prompt de sistema literal cacheado y la pista de estilo de respuesta.
 * Un turno con imágenes se envía como `content` multimodal (formato compatible OpenAI).
 */
function buildMessages(turns: readonly TutorTurn[], grade?: Grade) {
  const messages: Array<{
    role: "user" | "assistant" | "system";
    content: OpenRouterContent;
  }> = [
    {
      role: "system",
      content: buildSystemPrompt(grade),
    },
  ];

  messages.push({ role: "system", content: REPLY_STYLE_HINT });

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
  emit: (delta: string) => void,
  updateUsage: (usage: TutorUsage) => void,
): void {
  const delta = event.choices?.[0]?.delta?.content;
  if (delta) {
    emit(delta);
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
