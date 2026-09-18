import Anthropic from "@anthropic-ai/sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ELI_SYSTEM_PROMPT, REFUSAL_MESSAGE, UPSTREAM_ERROR_MESSAGE } from "@/lib/ai/prompt";
import {
  AnthropicProvider,
  buildSystem,
  FALLBACK_BETA,
  toStopReason,
  type UpstreamMessage,
} from "@/lib/ai/providers/anthropic";
import type { TutorReplyInput } from "@/lib/contracts/ai";
import { getEnv, resetEnvCache } from "@/lib/env";

/** Guion de la respuesta simulada del SDK. */
interface Script {
  text?: string[];
  final?: Partial<UpstreamMessage>;
  /** Uso parcial visto en `streamEvent` antes del final (o del error). */
  snapshot?: UpstreamMessage;
  error?: Error;
}

interface StreamCall {
  params: Record<string, unknown>;
  options?: { signal?: AbortSignal };
}

type Listener = (...args: unknown[]) => void;

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const usage = (over: Partial<UpstreamMessage["usage"]> = {}): UpstreamMessage["usage"] => ({
  input_tokens: 120,
  output_tokens: 40,
  cache_read_input_tokens: null,
  cache_creation_input_tokens: null,
  ...over,
});

/** Imita `MessageStream`/`BetaMessageStream`: emite `text` al pedir `finalMessage()` y respeta `signal`. */
function fakeStream(script: Script, signal?: AbortSignal) {
  const listeners = new Map<string, Listener[]>();
  const emit = (event: string, ...args: unknown[]) =>
    listeners.get(event)?.forEach((listener) => listener(...args));
  return {
    on(event: string, listener: Listener) {
      listeners.set(event, [...(listeners.get(event) ?? []), listener]);
      return this;
    },
    async finalMessage(): Promise<UpstreamMessage> {
      for (const delta of script.text ?? []) {
        await tick();
        if (signal?.aborted) throw new Anthropic.APIUserAbortError();
        emit("text", delta, delta);
      }
      if (script.snapshot) emit("streamEvent", { type: "message_delta" }, script.snapshot);
      await tick();
      if (signal?.aborted) throw new Anthropic.APIUserAbortError();
      if (script.error) throw script.error;
      return {
        model: "claude-fable-5-1",
        stop_reason: "end_turn",
        usage: usage(),
        ...script.final,
      };
    },
  };
}

function fakeClient(script: Script) {
  const calls = { plain: [] as StreamCall[], beta: [] as StreamCall[] };
  const stream =
    (bucket: StreamCall[]) =>
    (params: Record<string, unknown>, options?: StreamCall["options"]) => {
      bucket.push({ params, options });
      return fakeStream(script, options?.signal);
    };
  const client = {
    messages: { stream: stream(calls.plain) },
    beta: { messages: { stream: stream(calls.beta) } },
  } as unknown as Anthropic;
  return { client, calls };
}

async function readAll(stream: ReadableStream<string>): Promise<string> {
  const reader = stream.getReader();
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return text;
    text += value;
  }
}

const input: TutorReplyInput = {
  sessionId: "33333333-3333-4333-8333-333333333333",
  messages: [
    { role: "user", content: "Tengo este problema: 3/4 + 1/2" },
    { role: "assistant", content: "¿Qué **datos** tienes?" },
    { role: "user", content: "me trabé en el denominador" },
  ],
};

const ENV_KEYS = [
  "ANTHROPIC_MODEL",
  "ANTHROPIC_EFFORT",
  "ANTHROPIC_FALLBACK_MODEL",
  "AI_MAX_OUTPUT_TOKENS",
];

describe("AnthropicProvider", () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});

  beforeEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
    resetEnvCache();
    error.mockClear();
  });

  afterEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
    resetEnvCache();
  });

  it("llama a messages.stream con el system cacheado, effort y max_tokens, sin temperature ni thinking", async () => {
    const { client, calls } = fakeClient({ text: ["Buen ", "intento."] });
    const provider = new AnthropicProvider({ client });
    expect(provider.name).toBe("anthropic");
    expect(provider.model).toBe("claude-fable-5-1");

    const { stream, done } = await provider.reply(input);
    expect(await readAll(stream)).toBe("Buen intento.");
    const result = await done;

    expect(calls.beta).toHaveLength(0);
    expect(calls.plain).toHaveLength(1);
    const { params, options } = calls.plain[0];
    expect(params).toEqual({
      model: "claude-fable-5-1",
      max_tokens: 1024,
      system: [{ type: "text", text: ELI_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      output_config: { effort: "low" },
      messages: input.messages,
    });
    expect(params).not.toHaveProperty("temperature");
    expect(params).not.toHaveProperty("thinking");
    expect(params).not.toHaveProperty("betas");
    expect(options?.signal).toBeInstanceOf(AbortSignal);

    expect(result).toMatchObject({
      model: "claude-fable-5-1",
      stopReason: "end_turn",
      usage: { inputTokens: 120, outputTokens: 40, cacheReadTokens: 0, cacheWriteTokens: 0 },
    });
    expect(result.ttfbMs).toBeGreaterThanOrEqual(0);
    expect(result.latencyMs).toBeGreaterThanOrEqual(result.ttfbMs);
    expect(error).not.toHaveBeenCalled();
  });

  it("lee modelo, effort y max_tokens del entorno y mapea los tokens de caché", async () => {
    process.env.ANTHROPIC_MODEL = "claude-opus-5";
    process.env.ANTHROPIC_EFFORT = "medium";
    process.env.AI_MAX_OUTPUT_TOKENS = "256";
    resetEnvCache();
    const { client, calls } = fakeClient({
      text: ["ok"],
      final: {
        model: "claude-opus-5",
        usage: usage({ cache_read_input_tokens: 200, cache_creation_input_tokens: 15 }),
      },
    });
    const provider = new AnthropicProvider({ client });
    expect(provider.model).toBe("claude-opus-5");

    const { stream, done } = await provider.reply(input);
    await readAll(stream);
    expect(calls.plain[0].params).toMatchObject({
      model: "claude-opus-5",
      max_tokens: 256,
      output_config: { effort: "medium" },
    });
    expect((await done).usage).toEqual({
      inputTokens: 120,
      outputTokens: 40,
      cacheReadTokens: 200,
      cacheWriteTokens: 15,
    });
  });

  it("refusal: el stream contiene REFUSAL_MESSAGE y done dice refusal", async () => {
    const { client } = fakeClient({ final: { stop_reason: "refusal" } });
    const { stream, done } = await new AnthropicProvider({ client }).reply(input);
    expect(await readAll(stream)).toBe(REFUSAL_MESSAGE);
    expect((await done).stopReason).toBe("refusal");
    expect(error).not.toHaveBeenCalled();
  });

  it("refusal a mitad de respuesta: conserva el texto y separa el aviso con una línea en blanco", async () => {
    const { client } = fakeClient({ text: ["Vamos a ver…"], final: { stop_reason: "refusal" } });
    const { stream } = await new AnthropicProvider({ client }).reply(input);
    expect(await readAll(stream)).toBe(`Vamos a ver…\n\n${REFUSAL_MESSAGE}`);
  });

  it("max_tokens: conserva el texto parcial y done dice max_tokens", async () => {
    const { client } = fakeClient({
      text: ["Primero, los da"],
      final: { stop_reason: "max_tokens" },
    });
    const { stream, done } = await new AnthropicProvider({ client }).reply(input);
    expect(await readAll(stream)).toBe("Primero, los da");
    expect((await done).stopReason).toBe("max_tokens");
  });

  it("RateLimitError: mensaje amable en el stream, stopReason error, uso parcial y log sin contenido", async () => {
    const rateLimited = Anthropic.APIError.generate(
      429,
      { type: "error", error: { type: "rate_limit_error", message: "Too many requests" } },
      "Too many requests",
      new Headers(),
    );
    expect(rateLimited).toBeInstanceOf(Anthropic.RateLimitError);
    const partial: UpstreamMessage = {
      model: "claude-fable-5-1",
      stop_reason: null,
      usage: usage({ output_tokens: 7 }),
    };
    const { client } = fakeClient({ text: ["Vamos"], snapshot: partial, error: rateLimited });

    const { stream, done } = await new AnthropicProvider({ client }).reply(input);
    expect(await readAll(stream)).toBe(`Vamos\n\n${UPSTREAM_ERROR_MESSAGE}`);
    const result = await done;
    expect(result.stopReason).toBe("error");
    expect(result.usage).toEqual({
      inputTokens: 120,
      outputTokens: 7,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    });
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0][1]).toMatchObject({
      provider: "anthropic",
      name: "RateLimitError",
      status: 429,
      type: "rate_limit_error",
    });
    expect(JSON.stringify(error.mock.calls[0])).not.toContain("denominador");
  });

  it("APIError genérico sin texto previo: solo el mensaje amable, con uso a cero", async () => {
    const failure = Anthropic.APIError.generate(
      500,
      { type: "error", error: { type: "api_error", message: "Internal server error" } },
      "Internal server error",
      new Headers(),
    );
    const { client } = fakeClient({ error: failure });
    const { stream, done } = await new AnthropicProvider({ client }).reply(input);
    expect(await readAll(stream)).toBe(UPSTREAM_ERROR_MESSAGE);
    const result = await done;
    expect(result.stopReason).toBe("error");
    expect(result.model).toBe("claude-fable-5-1");
    expect(result.usage).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    });
    expect(result.ttfbMs).toBeGreaterThanOrEqual(0);
    expect(result.ttfbMs).toBeLessThanOrEqual(result.latencyMs);
  });

  it("ANTHROPIC_FALLBACK_MODEL: usa beta.messages.stream con la beta y fallbacks, y done.model es el que respondió", async () => {
    process.env.ANTHROPIC_FALLBACK_MODEL = "claude-opus-4-8";
    resetEnvCache();
    const { client, calls } = fakeClient({ text: ["ok"], final: { model: "claude-opus-4-8" } });
    const provider = new AnthropicProvider({ client });
    expect(provider.fallbackModel).toBe("claude-opus-4-8");

    const { stream, done } = await provider.reply(input);
    await readAll(stream);
    expect(calls.plain).toHaveLength(0);
    expect(calls.beta).toHaveLength(1);
    expect(calls.beta[0].params).toMatchObject({
      model: "claude-fable-5-1",
      betas: [FALLBACK_BETA],
      fallbacks: [{ model: "claude-opus-4-8" }],
      output_config: { effort: "low" },
    });
    expect(FALLBACK_BETA).toBe("server-side-fallback-2026-06-01");
    expect((await done).model).toBe("claude-opus-4-8");
    expect(provider.model).toBe("claude-fable-5-1");
  });

  it("añade la asignatura como bloque de sistema separado, después del bloque cacheado", async () => {
    const { client, calls } = fakeClient({ text: ["ok"] });
    await readAll(
      (await new AnthropicProvider({ client }).reply({ ...input, subject: "ciencias" })).stream,
    );
    const system = calls.plain[0].params.system as ReturnType<typeof buildSystem>;
    expect(system).toHaveLength(2);
    expect(system[0]).toEqual({
      type: "text",
      text: ELI_SYSTEM_PROMPT,
      cache_control: { type: "ephemeral" },
    });
    expect(system[1]).toEqual({
      type: "text",
      text: "La alumna ha elegido la asignatura: Ciencias.",
    });
    expect(buildSystem(undefined)).toHaveLength(1);
  });

  it("cancelar el stream aborta la petición sin añadir avisos ni logs", async () => {
    const { client, calls } = fakeClient({ text: ["uno", "dos", "tres"] });
    const { stream, done } = await new AnthropicProvider({ client }).reply(input);
    const reader = stream.getReader();
    expect((await reader.read()).value).toBe("uno");
    await reader.cancel();
    expect(calls.plain[0].options?.signal?.aborted).toBe(true);
    const result = await done;
    expect(result.stopReason).toBe("error");
    expect(error).not.toHaveBeenCalled();
  });

  it("propaga el signal de la petición al SDK", async () => {
    const { client, calls } = fakeClient({ text: ["uno", "dos", "tres"] });
    const controller = new AbortController();
    const { stream, done } = await new AnthropicProvider({ client }).reply({
      ...input,
      signal: controller.signal,
    });
    const reader = stream.getReader();
    expect((await reader.read()).value).toBe("uno");
    controller.abort();
    expect(calls.plain[0].options?.signal?.aborted).toBe(true);
    expect((await done).stopReason).toBe("error");
    expect(error).not.toHaveBeenCalled();
    await reader.cancel();
  });

  it("acepta un env explícito y por defecto construye el cliente del SDK", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    resetEnvCache();
    const provider = new AnthropicProvider({
      env: { ...getEnv(), ANTHROPIC_MODEL: "claude-opus-5" },
    });
    expect(provider.model).toBe("claude-opus-5");
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("T-051: con imagen en el último turno, antepone el bloque image al texto (Claude ya es multimodal)", async () => {
    const { client, calls } = fakeClient({ text: ["Veo tu foto."] });
    const withImage: TutorReplyInput = {
      ...input,
      messages: [
        ...input.messages.slice(0, -1),
        {
          role: "user",
          content: "me trabé en el denominador",
          images: [{ mediaType: "image/jpeg", data: "ZmFrZS1pbWFnZQ==" }],
        },
      ],
    };
    await readAll((await new AnthropicProvider({ client }).reply(withImage)).stream);

    const messages = calls.plain[0].params.messages as Array<{ content: unknown }>;
    expect(messages.at(-1)?.content).toEqual([
      {
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data: "ZmFrZS1pbWFnZQ==" },
      },
      { type: "text", text: "me trabé en el denominador" },
    ]);
    // Los turnos sin imagen siguen siendo texto plano, sin envolver en un array.
    expect(messages[0]?.content).toBe(input.messages[0].content);
  });

  it("mapea stop_reason", () => {
    expect(toStopReason("end_turn")).toBe("end_turn");
    expect(toStopReason("max_tokens")).toBe("max_tokens");
    expect(toStopReason("model_context_window_exceeded")).toBe("max_tokens");
    expect(toStopReason("refusal")).toBe("refusal");
    expect(toStopReason("stop_sequence")).toBe("end_turn");
    expect(toStopReason(null)).toBe("end_turn");
  });
});
