import { getProvider } from "@/lib/ai/providers";
import { slidingWindow } from "@/lib/ai/window";
import type { TutorProvider, TutorReplyInput, TutorReplyResult } from "@/lib/contracts/ai";

/** Entrada que ningún proveedor puede atender; la ruta la traduce a `400 invalid_request`. */
export class TutorInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TutorInputError";
  }
}

export interface StreamTutorReplyOptions {
  /** Proveedor explícito (tests y herramientas); por defecto el que dicta el entorno. */
  provider?: TutorProvider;
}

/**
 * Servicio de IA del contrato 6.2: descarta los turnos en blanco, aplica la ventana deslizante
 * (`AI_WINDOW_PAIRS`), elige el proveedor y devuelve `{ stream, done }`.
 *
 * Lanza `TutorInputError` si tras el recorte no queda un último turno de la alumna (la API rechaza
 * historiales vacíos o que terminan en `assistant`). Los fallos del proveedor no lanzan: llegan en
 * `done.stopReason === "error"` con un mensaje amable dentro del stream.
 */
export async function streamTutorReply(
  input: TutorReplyInput,
  options: StreamTutorReplyOptions = {},
): Promise<TutorReplyResult> {
  const history = input.messages.filter((turn) => turn.content.trim().length > 0);
  const messages = slidingWindow(history);
  const last = messages.at(-1);
  if (!last || last.role !== "user") {
    throw new TutorInputError("El último mensaje debe ser de la alumna y no puede estar vacío.");
  }
  const provider = options.provider ?? (await getProvider());
  return provider.reply({ ...input, messages });
}
