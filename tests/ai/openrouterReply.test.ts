import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpenRouterProvider } from "@/lib/ai/providers/openrouter";
import { UPSTREAM_ERROR_MESSAGE } from "@/lib/ai/prompt";
import type { TutorReplyInput } from "@/lib/contracts/ai";
import { getEnv, resetEnvCache } from "@/lib/env";

const PRIMARY = "nvidia/nemotron-3.5-lightning:free";
const FALLBACK = "deepseek/deepseek-v4-flash-0731:free"; // por defecto de OPENROUTER_FALLBACK_MODEL
const VISION = "google/gemma-4-31b-it:free";
const VISION_FALLBACK = "qwen/qwen3.8-27b:free"; // por defecto de OPENROUTER_VISION_FALLBACK_MODEL

const ENV_KEYS = [
  "OPENROUTER_API_KEY",
  "OPENROUTER_FALLBACK_MODEL",
  "OPENROUTER_VISION_FALLBACK_MODEL",
  "OPENROUTER_FIRST_TOKEN_TIMEOUT_MS",
];

const input: TutorReplyInput = {
  sessionId: "s",
  messages: [{ role: "user", content: "No me queda claro la diferencia entre evaporación y transpiración" }],
};

const GOOD_ANSWER =
  "¡Buena pregunta! 🌿 Vamos por partes. Piensa en un charco al sol: **¿qué crees que le pasa al agua?**";
const LEAKED = `Here's a thinking process:

1. Analyze User Input:
   User says: "No me queda claro la diferencia entre evaporación y transpiración"
   Language: Spanish

Wait, I violated rules. I gave parts of the answer. Forbidden.`;

const sse = (text: string, size = 25) => {
  const events: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    events.push(`data: ${JSON.stringify({ choices: [{ delta: { content: text.slice(i, i + size) } }] })}\n`);
  }
  events.push("data: [DONE]\n");
  return new Response(events.join(""), { status: 200 });
};

/** Respuesta que se queda colgada hasta que se aborta la petición, como un modelo saturado. */
const hanging = (signal: AbortSignal | null | undefined) =>
  new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        signal?.addEventListener("abort", () => controller.error(new DOMException("aborted", "AbortError")));
      },
    }),
    { status: 200 },
  );

async function readAll(stream: ReadableStream<string>): Promise<string> {
  const reader = stream.getReader();
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return out;
    out += value;
  }
}

describe("OpenRouterProvider: la niña solo ve la respuesta final", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;
  const modelsCalled = () =>
    fetchSpy.mock.calls.map((call: unknown[]) => JSON.parse((call[1] as RequestInit).body as string).model);

  beforeEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
    process.env.OPENROUTER_API_KEY = "test-key";
    resetEnvCache();
    error = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
    resetEnvCache();
    fetchSpy.mockRestore();
    error.mockRestore();
  });

  it("una respuesta normal llega entera y con una sola petición", async () => {
    fetchSpy.mockResolvedValue(sse(GOOD_ANSWER));
    const { stream, done } = await new OpenRouterProvider({ env: getEnv() }).reply(input);

    expect(await readAll(stream)).toBe(GOOD_ANSWER);
    expect((await done).stopReason).toBe("end_turn");
    expect(modelsCalled()).toEqual([PRIMARY]);
  });

  it("si el modelo devuelve su razonamiento, no se enseña y se responde con el modelo de respaldo", async () => {
    fetchSpy
      .mockResolvedValueOnce(sse(LEAKED))
      .mockResolvedValueOnce(sse(GOOD_ANSWER));

    const { stream, done } = await new OpenRouterProvider({ env: getEnv() }).reply(input);
    const shown = await readAll(stream);

    expect(shown).toBe(GOOD_ANSWER);
    expect(shown).not.toMatch(/thinking process|Analyze User Input|I violated/i);
    const result = await done;
    expect(result.model).toBe(FALLBACK);
    expect(result.stopReason).toBe("end_turn");
    expect(modelsCalled()).toEqual([PRIMARY, FALLBACK]);
  });

  it("si el respaldo también devuelve razonamiento, la niña ve el aviso amable y nunca el razonamiento", async () => {
    // Una respuesta nueva en cada llamada: un `Response` no se puede leer dos veces.
    fetchSpy.mockImplementation(async () => sse(LEAKED));

    const { stream, done } = await new OpenRouterProvider({ env: getEnv() }).reply(input);
    const shown = await readAll(stream);

    expect(shown).toBe(UPSTREAM_ERROR_MESSAGE);
    expect((await done).stopReason).toBe("error");
    expect(modelsCalled()).toEqual([PRIMARY, FALLBACK]);
  });

  it("quita los bloques <think> de la respuesta, lleguen como lleguen", async () => {
    fetchSpy.mockResolvedValue(sse(`<think>La alumna pregunta por el ciclo del agua…</think>\n\n${GOOD_ANSWER}`, 7));

    const { stream } = await new OpenRouterProvider({ env: getEnv() }).reply(input);
    expect(await readAll(stream)).toBe(GOOD_ANSWER);
    expect(modelsCalled()).toEqual([PRIMARY]);
  });

  it("con una foto, el razonamiento filtrado tampoco se enseña (y el respaldo es el visual, nunca el de texto)", async () => {
    fetchSpy.mockImplementation(async () => sse(LEAKED));
    const withImage: TutorReplyInput = {
      ...input,
      messages: [{ role: "user", content: "mira", images: [{ mediaType: "image/png", data: "ZmFrZQ==" }] }],
    };

    const { stream, done } = await new OpenRouterProvider({ env: getEnv() }).reply(withImage);
    expect(await readAll(stream)).toBe(UPSTREAM_ERROR_MESSAGE);
    expect((await done).stopReason).toBe("error");
    expect(modelsCalled()).toEqual([VISION, VISION_FALLBACK]);
  });

  describe("preguntas con foto: un 429 del modelo visual gratuito (el fallo real en producción)", () => {
    const withImage: TutorReplyInput = {
      ...input,
      messages: [{ role: "user", content: "mira mi tarea", images: [{ mediaType: "image/png", data: "ZmFrZQ==" }] }],
    };
    const rateLimited = () =>
      new Response(
        JSON.stringify({ error: { message: "Provider returned error", code: 429, metadata: { provider_name: "Google AI Studio" } } }),
        { status: 429 },
      );

    it("responde con el modelo visual de respaldo, que recibe la foto", async () => {
      fetchSpy.mockImplementationOnce(async () => rateLimited()).mockImplementationOnce(async () => sse(GOOD_ANSWER));

      const { stream, done } = await new OpenRouterProvider({ env: getEnv() }).reply(withImage);
      expect(await readAll(stream)).toBe(GOOD_ANSWER);

      const result = await done;
      expect(result.model).toBe(VISION_FALLBACK);
      expect(result.stopReason).toBe("end_turn");
      expect(modelsCalled()).toEqual([VISION, VISION_FALLBACK]);
      // El respaldo recibe la misma foto, no un turno de solo texto.
      const secondBody = JSON.parse((fetchSpy.mock.calls[1][1] as RequestInit).body as string);
      const lastTurn = secondBody.messages.at(-1);
      expect(lastTurn.content.some((part: { type: string }) => part.type === "image_url")).toBe(true);
    });

    it("si el respaldo visual también falla, la niña ve el aviso amable (no el error técnico)", async () => {
      fetchSpy.mockImplementation(async () => rateLimited());

      const { stream, done } = await new OpenRouterProvider({ env: getEnv() }).reply(withImage);
      const shown = await readAll(stream);
      expect(shown).toBe(UPSTREAM_ERROR_MESSAGE);
      expect(shown).not.toMatch(/429|rate-limited|OpenRouter/i);
      expect((await done).stopReason).toBe("error");
      expect(modelsCalled()).toEqual([VISION, VISION_FALLBACK]);
    });

    it("el modelo de texto sigue sin usarse para fotos", async () => {
      fetchSpy.mockImplementation(async () => rateLimited());
      const { stream } = await new OpenRouterProvider({ env: getEnv() }).reply(withImage);
      await readAll(stream);
      expect(modelsCalled()).not.toContain(PRIMARY);
      expect(modelsCalled()).not.toContain(FALLBACK);
    });
  });
});

describe("OpenRouterProvider: un modelo colgado no agota los 60 s de la función", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
    process.env.OPENROUTER_API_KEY = "test-key";
    process.env.OPENROUTER_FIRST_TOKEN_TIMEOUT_MS = "60";
    resetEnvCache();
    error = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
    resetEnvCache();
    fetchSpy.mockRestore();
    error.mockRestore();
  });

  it("si no llega texto a tiempo, aborta el intento y contesta con el modelo de respaldo", async () => {
    fetchSpy
      .mockImplementationOnce(async (_url: unknown, init?: RequestInit) => hanging(init?.signal))
      .mockImplementationOnce(async () => sse(GOOD_ANSWER));

    const started = Date.now();
    const { stream, done } = await new OpenRouterProvider({ env: getEnv() }).reply(input);

    expect(await readAll(stream)).toBe(GOOD_ANSWER);
    expect((await done).model).toBe(FALLBACK);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(Date.now() - started).toBeLessThan(2000);
    expect(((fetchSpy.mock.calls[0][1] as RequestInit).signal as AbortSignal).aborted).toBe(true);
  });

  it("si el respaldo también se cuelga, avisa con amabilidad en vez de dejar la petición abierta", async () => {
    fetchSpy.mockImplementation(async (_url: unknown, init?: RequestInit) => hanging(init?.signal));

    const { stream, done } = await new OpenRouterProvider({ env: getEnv() }).reply(input);
    expect(await readAll(stream)).toBe(UPSTREAM_ERROR_MESSAGE);
    expect((await done).stopReason).toBe("error");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("el temporizador no corta una respuesta que ya empezó a llegar", async () => {
    fetchSpy.mockResolvedValue(sse(GOOD_ANSWER));
    const { stream } = await new OpenRouterProvider({ env: getEnv() }).reply(input);
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(await readAll(stream)).toBe(GOOD_ANSWER);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
