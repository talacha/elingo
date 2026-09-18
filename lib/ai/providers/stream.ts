import { REFUSAL_MESSAGE, UPSTREAM_ERROR_MESSAGE } from "@/lib/ai/prompt";
import type {
  ProviderName,
  StopReason,
  TutorReplyDone,
  TutorReplyResult,
  TutorUsage,
} from "@/lib/contracts/ai";

export const ZERO_USAGE: Readonly<TutorUsage> = Object.freeze({
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
});

/** Lo que un proveedor sabe al terminar de producir texto; los tiempos los añade `createTutorStream`. */
export interface TutorOutcome {
  usage: TutorUsage;
  /** Modelo que respondió de verdad (con `fallbacks` puede no ser el configurado). */
  model: string;
  stopReason: StopReason;
  /** Solo con `stopReason: "error"`: el error original, para el log del servidor. */
  error?: unknown;
}

export interface TutorStreamHandle {
  /** Encola un delta de texto. Ignora cadenas vacías y todo lo que llegue tras la cancelación. */
  emit(delta: string): void;
  /** Se aborta si el consumidor cancela el stream o si `signal` de la petición aborta. */
  readonly signal: AbortSignal;
  /** `true` en cuanto se ha emitido algún texto. */
  readonly emitted: boolean;
}

export interface TutorStreamOptions {
  provider: ProviderName;
  /** Modelo configurado; se usa en el log y cuando el proveedor falla antes de responder. */
  model: string;
  signal?: AbortSignal;
  /** Produce los deltas con `handle.emit` y devuelve el resultado. Puede lanzar: se trata como error. */
  produce(handle: TutorStreamHandle): Promise<TutorOutcome>;
}

/**
 * Construye el par `{ stream, done }` del contrato 6.2 para cualquier proveedor.
 *
 * - `stream` emite los deltas de texto y se cierra solo al terminar.
 * - `done` nunca rechaza: si el proveedor falla, resuelve con `stopReason: "error"`.
 * - Con `refusal` añade `REFUSAL_MESSAGE` al stream; con `error` (sin cancelación previa) añade
 *   `UPSTREAM_ERROR_MESSAGE`. Si ya había texto, separa con una línea en blanco.
 * - `ttfbMs` es el tiempo hasta el primer delta emitido; sin ningún delta coincide con `latencyMs`.
 * - Cancelar el stream (cliente desconectado) aborta `handle.signal` y silencia los avisos.
 */
export function createTutorStream(options: TutorStreamOptions): TutorReplyResult {
  const startedAt = performance.now();
  const elapsed = () => Math.round(performance.now() - startedAt);
  const aborter = new AbortController();
  const forwardAbort = () => aborter.abort();
  let controller!: ReadableStreamDefaultController<string>;
  let closed = false;
  let emitted = false;
  let ttfbMs = 0;

  const stream = new ReadableStream<string>({
    start(c) {
      controller = c;
    },
    cancel() {
      closed = true;
      aborter.abort();
    },
  });

  if (options.signal?.aborted) aborter.abort();
  else options.signal?.addEventListener("abort", forwardAbort, { once: true });

  const handle: TutorStreamHandle = {
    signal: aborter.signal,
    get emitted() {
      return emitted;
    },
    emit(delta) {
      if (closed || delta.length === 0) return;
      if (!emitted) {
        emitted = true;
        ttfbMs = elapsed();
      }
      controller.enqueue(delta);
    },
  };

  const appendNotice = (text: string) => handle.emit(emitted ? `\n\n${text}` : text);

  const done: Promise<TutorReplyDone> = (async () => {
    let outcome: TutorOutcome;
    try {
      outcome = await options.produce(handle);
    } catch (error) {
      outcome = { usage: { ...ZERO_USAGE }, model: options.model, stopReason: "error", error };
    }

    if (outcome.stopReason === "refusal") appendNotice(REFUSAL_MESSAGE);
    if (outcome.stopReason === "error" && !aborter.signal.aborted) {
      appendNotice(UPSTREAM_ERROR_MESSAGE);
      logProviderError(options.provider, outcome.model, outcome.error);
    }

    options.signal?.removeEventListener("abort", forwardAbort);
    if (!closed) {
      closed = true;
      controller.close();
    }
    const latencyMs = elapsed();
    return {
      usage: outcome.usage,
      model: outcome.model,
      stopReason: outcome.stopReason,
      latencyMs,
      ttfbMs: emitted ? ttfbMs : latencyMs,
    };
  })();

  return { stream, done };
}

/** Una línea de log sin contenido de mensajes: solo el tipo de error, su estado HTTP y su mensaje. */
function logProviderError(provider: ProviderName, model: string, error: unknown): void {
  const detail =
    error instanceof Error
      ? {
          name: error.constructor.name,
          message: error.message,
          status: "status" in error && typeof error.status === "number" ? error.status : undefined,
          type: "type" in error && typeof error.type === "string" ? error.type : undefined,
        }
      : { value: String(error) };
  console.error("[ai] fallo del proveedor", { provider, model, ...detail });
}
