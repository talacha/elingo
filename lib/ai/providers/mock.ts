import { createTutorStream, type TutorOutcome } from "@/lib/ai/providers/stream";
import type {
  TutorProvider,
  TutorReplyInput,
  TutorReplyResult,
  TutorTurn,
  TutorUsage,
} from "@/lib/contracts/ai";
import type { Subject } from "@/lib/contracts/chat";
import { getEnv, type Env } from "@/lib/env";

export const MOCK_MODEL = "eli-mock";

export interface MockProviderOptions {
  env?: Env;
  /** Retardo entre chunks; por defecto `MOCK_DELAY_MS` (0 en tests). */
  delayMs?: number;
}

/**
 * Proveedor sin clave: respuesta socrática determinista en ~6 chunks, con negritas y viñetas y
 * sin ningún dígito (nunca contiene un resultado). Si el último mensaje pide la solución, redirige.
 */
export class MockProvider implements TutorProvider {
  readonly name = "mock" as const;
  readonly model = MOCK_MODEL;
  private readonly delayMs: number;

  constructor(options: MockProviderOptions = {}) {
    this.delayMs = options.delayMs ?? (options.env ?? getEnv()).MOCK_DELAY_MS;
  }

  async reply(input: TutorReplyInput): Promise<TutorReplyResult> {
    const chunks = mockReplyChunks(input);
    return createTutorStream({
      provider: this.name,
      model: this.model,
      signal: input.signal,
      produce: async (handle): Promise<TutorOutcome> => {
        for (const chunk of chunks) {
          if (this.delayMs > 0) await sleep(this.delayMs, handle.signal);
          if (handle.signal.aborted) break;
          handle.emit(chunk);
        }
        return {
          usage: estimateUsage(input.messages, chunks),
          model: this.model,
          stopReason: handle.signal.aborted ? "error" : "end_turn",
        };
      },
    });
  }
}

const ANSWER_REQUESTS: readonly RegExp[] = [
  /dame (la|el|una) (respuesta|resultado|solucion)/,
  /cual es (el|la) (resultado|respuesta|solucion)/,
  /\bsolucion\b/,
  /respuesta final/,
  /dime (el|la) (resultado|respuesta)/,
  /resuelve(lo|melo)\b/,
];

/** "Trampa": la alumna pide el resultado en vez de ayuda ("dame la respuesta", "¿cuál es el resultado?", "solución"). */
export function asksForTheAnswer(text: string): boolean {
  const plain = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return ANSWER_REQUESTS.some((pattern) => pattern.test(plain));
}

interface Guide {
  focus: string;
  questions: string;
  analogy: string;
}

const GUIDES: Record<Subject | "general", Guide> = {
  mates: {
    focus: "**Primero, los datos.** Antes de calcular nada, dime:\n",
    questions: "- ¿Qué **datos** te da el enunciado?\n- ¿Qué te **pregunta** exactamente?\n\n",
    analogy: "Piensa en una receta: sin conocer los ingredientes no puedes empezar a cocinar.\n\n",
  },
  lengua: {
    focus: "**Primero, la misión.** Antes de escribir nada, dime:\n",
    questions: "- ¿De qué **habla** el texto o la frase?\n- ¿Qué te **piden** hacer con ella?\n\n",
    analogy: "Piensa en un videojuego: cada párrafo es una misión con un objetivo claro.\n\n",
  },
  ciencias: {
    focus: "**Primero, la observación.** Antes de responder, dime:\n",
    questions:
      "- ¿Qué **observas** en el enunciado?\n- ¿Qué crees que **pasaría** si cambiara un detalle?\n\n",
    analogy:
      "**Trivia rápida:** ¿qué hace un científico antes de sacar conclusiones? Observar y preguntar.\n\n",
  },
  general: {
    focus: "**Primero, lo importante.** Antes de responder, dime:\n",
    questions: "- ¿Qué **sabes** ya del problema?\n- ¿Qué te **piden** exactamente?\n\n",
    analogy: "Piensa en un mapa: antes de moverte, conviene saber dónde estás y adónde vas.\n\n",
  },
};

const REDIRECT_CHUNKS: readonly string[] = [
  "**Buen intento**, pero mi trabajo no es darte el resultado: es ayudarte a que lo consigas tú.\n\n",
  "Si te lo digo yo, mañana te volverás a trabar en el mismo sitio.\n\n",
  "Hagamos un trato:\n",
  "- Dime qué **datos** tienes claros.\n- Dime en qué **paso** te has quedado.\n\n",
  "Y yo te doy una **pista** para desatascarte.\n\n",
  "¿Empezamos?",
];

/** T-051: reconoce una imagen adjunta sin desvelar el resultado (el mock nunca "ve" de verdad la foto). */
const IMAGE_ACK = "**He recibido tu foto.** Aunque aún no la puedo mirar en este modo de pruebas.\n\n";

/** Los chunks de la respuesta, en orden. Determinista: solo depende del último mensaje y la asignatura. */
export function mockReplyChunks(input: Pick<TutorReplyInput, "messages" | "subject">): string[] {
  const last = input.messages.at(-1);
  if (last?.role === "user" && asksForTheAnswer(last.content)) return [...REDIRECT_CHUNKS];
  const guide = GUIDES[input.subject ?? "general"];
  const chunks = [
    "¡Vamos a por ello! Lo resolvemos **paso a paso**, sin saltarnos nada.\n\n",
    guide.focus,
    guide.questions,
    guide.analogy,
    "Escríbeme solo el **primer paso** que darías y lo revisamos juntos.\n\n",
    "**Tú puedes.** Estoy aquí para darte pistas, no para hacerlo por ti.",
  ];
  return last?.images?.length ? [IMAGE_ACK, ...chunks] : chunks;
}

/** Estimación grosera (~4 caracteres por token), suficiente para probar logs y presupuestos. */
function estimateUsage(messages: readonly TutorTurn[], chunks: readonly string[]): TutorUsage {
  const inputChars = messages.reduce((total, turn) => total + turn.content.length, 0);
  const outputChars = chunks.reduce((total, chunk) => total + chunk.length, 0);
  return {
    inputTokens: Math.ceil(inputChars / 4),
    outputTokens: Math.ceil(outputChars / 4),
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  };
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(finish, ms);
    function finish() {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    }
    signal.addEventListener("abort", finish, { once: true });
  });
}
