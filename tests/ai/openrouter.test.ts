import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ELI_SYSTEM_PROMPT, REFUSAL_MESSAGE, REPLY_STYLE_HINT, UPSTREAM_ERROR_MESSAGE } from "@/lib/ai/prompt";
import { OpenRouterProvider } from "@/lib/ai/providers/openrouter";
import type { TutorReplyInput } from "@/lib/contracts/ai";
import { getEnv, resetEnvCache } from "@/lib/env";

/** Simula la respuesta de OpenRouter en formato SSE. */
function createSSEResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk + "\n"));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n"));
      controller.close();
    },
  });

  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
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
  sessionId: "22222222-2222-4222-8222-222222222222",
  messages: [
    { role: "user", content: "Tengo este problema: 3/4 + 1/2" },
    { role: "assistant", content: "¿Qué datos tienes?" },
    { role: "user", content: "me trabé en el denominador" },
  ],
};

const ENV_KEYS = [
  "OPENROUTER_API_KEY",
  "OPENROUTER_MODEL",
  "OPENROUTER_VISION_MODEL",
  "OPENROUTER_FALLBACK_MODEL",
  "AI_MAX_OUTPUT_TOKENS",
  "NEXT_PUBLIC_APP_URL",
];

describe("OpenRouterProvider", () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
    resetEnvCache();
    error.mockClear();
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
    resetEnvCache();
    fetchSpy.mockRestore();
  });

  it("se identifica como openrouter y usa el modelo del entorno", () => {
    const provider = new OpenRouterProvider({ env: getEnv() });
    expect(provider.name).toBe("openrouter");
    expect(provider.model).toBe("nvidia/nemotron-3.5-lightning:free");
  });

  it("hace una petición POST a openrouter.ai con modelo, max_tokens, stream y usage", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    resetEnvCache();

    const chunks = [
      'data: {"choices": [{"delta": {"content": "Hola "}}], "usage": {"prompt_tokens": 10, "completion_tokens": 1}}',
      'data: {"choices": [{"delta": {"content": "mundo"}}], "usage": {"prompt_tokens": 10, "completion_tokens": 2}}',
    ];
    fetchSpy.mockResolvedValue(createSSEResponse(chunks));

    const provider = new OpenRouterProvider({ env: getEnv() });
    const { stream, done } = await provider.reply(input);

    expect(await readAll(stream)).toBe("Hola mundo");
    await done;

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const call = fetchSpy.mock.calls[0];
    expect(call[0]).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(call[1]?.method).toBe("POST");

    const body = JSON.parse(call[1]?.body as string);
    expect(body).toMatchObject({
      model: "nvidia/nemotron-3.5-lightning:free",
      max_tokens: 1024,
      stream: true,
      usage: { include: true },
      // El razonamiento de los modelos que lo separan no debe viajar en la respuesta.
      reasoning: { exclude: true },
    });
    // 2 mensajes de sistema (prompt literal + pista de estilo) + 3 turnos = 5 en total
    expect(body.messages).toHaveLength(5);
    expect(body.messages[0]).toEqual({
      role: "system",
      content: ELI_SYSTEM_PROMPT,
    });
    expect(body.messages[1]).toEqual({ role: "system", content: REPLY_STYLE_HINT });
  });

  it("envía los encabezados correctos: Authorization, HTTP-Referer, X-Title", async () => {
    process.env.OPENROUTER_API_KEY = "sk-test";
    process.env.NEXT_PUBLIC_APP_URL = "https://eli.ngo";
    resetEnvCache();

    const chunks = ['data: {"choices": [{"delta": {"content": "ok"}}]}'];
    fetchSpy.mockResolvedValue(createSSEResponse(chunks));

    const provider = new OpenRouterProvider({ env: getEnv() });
    await readAll((await provider.reply(input)).stream);

    const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer sk-test");
    expect(headers["HTTP-Referer"]).toBe("https://eli.ngo");
    expect(headers["X-Title"]).toBe("ELI");
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("parsea múltiples deltas SSE y emite el texto concatenado", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    resetEnvCache();

    const chunks = [
      'data: {"choices": [{"delta": {"content": "Primero"}}]}',
      'data: {"choices": [{"delta": {"content": ", "}}]}',
      'data: {"choices": [{"delta": {"content": "los datos"}}]}',
    ];
    fetchSpy.mockResolvedValue(createSSEResponse(chunks));

    const provider = new OpenRouterProvider();
    const { stream, done } = await provider.reply(input);
    expect(await readAll(stream)).toBe("Primero, los datos");

    const result = await done;
    expect(result.stopReason).toBe("end_turn");
    expect(result.model).toBe("nvidia/nemotron-3.5-lightning:free");
  });

  it("captura usage del evento SSE y lo devuelve en done", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    resetEnvCache();

    const chunks = [
      'data: {"choices": [{"delta": {"content": "Vamos"}}], "usage": {"prompt_tokens": 120, "completion_tokens": 40}}',
      'data: {"choices": [{"delta": {"content": "."}}], "usage": {"prompt_tokens": 120, "completion_tokens": 41}}',
    ];
    fetchSpy.mockResolvedValue(createSSEResponse(chunks));

    const provider = new OpenRouterProvider();
    const { stream, done } = await provider.reply(input);
    await readAll(stream);

    const result = await done;
    expect(result.usage).toEqual({
      inputTokens: 120,
      outputTokens: 41,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    });
  });

  it("mapea finish_reason length a max_tokens", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    resetEnvCache();

    const chunks = [
      'data: {"choices": [{"delta": {"content": "Texto "}}]}',
      'data: {"choices": [{"delta": {"content": "corto"}, "finish_reason": "length"}]}',
    ];
    fetchSpy.mockResolvedValue(createSSEResponse(chunks));

    const provider = new OpenRouterProvider();
    const { stream, done } = await provider.reply(input);
    expect(await readAll(stream)).toBe("Texto corto");

    const result = await done;
    expect(result.stopReason).toBe("max_tokens");
  });

  it("mapea finish_reason content_filter a refusal", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    resetEnvCache();

    const chunks = [
      'data: {"choices": [{"delta": {"content": "No puedo"}, "finish_reason": "content_filter"}]}',
    ];
    fetchSpy.mockResolvedValue(createSSEResponse(chunks));

    const provider = new OpenRouterProvider();
    const { stream, done } = await provider.reply(input);
    const text = await readAll(stream);

    const result = await done;
    expect(result.stopReason).toBe("refusal");
    expect(text).toContain("No puedo");
    expect(text).toContain(REFUSAL_MESSAGE);
  });

  it("con refusal a mitad de respuesta, conserva el texto y separa el aviso", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    resetEnvCache();

    const chunks = [
      'data: {"choices": [{"delta": {"content": "Vamos"}}]}',
      'data: {"choices": [{"delta": {"content": " a ver…"}, "finish_reason": "content_filter"}]}',
    ];
    fetchSpy.mockResolvedValue(createSSEResponse(chunks));

    const provider = new OpenRouterProvider();
    const { stream, done } = await provider.reply(input);
    const text = await readAll(stream);

    expect(text).toBe(`Vamos a ver…\n\n${REFUSAL_MESSAGE}`);
    expect((await done).stopReason).toBe("refusal");
  });

  it("error de red: stream contiene UPSTREAM_ERROR_MESSAGE y done dice error", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    resetEnvCache();

    fetchSpy.mockRejectedValue(new Error("Network error"));

    const provider = new OpenRouterProvider();
    const { stream, done } = await provider.reply(input);
    const text = await readAll(stream);

    expect(text).toBe(UPSTREAM_ERROR_MESSAGE);
    const result = await done;
    expect(result.stopReason).toBe("error");
    expect(result.usage).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    });
    expect(error).toHaveBeenCalled();
  });

  it("respuesta HTTP no OK: error manejado correctamente", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    resetEnvCache();

    fetchSpy.mockResolvedValue(
      new Response("Unauthorized", { status: 401, statusText: "Unauthorized" }),
    );

    const provider = new OpenRouterProvider();
    const { stream, done } = await provider.reply(input);
    const text = await readAll(stream);

    expect(text).toBe(UPSTREAM_ERROR_MESSAGE);
    const result = await done;
    expect(result.stopReason).toBe("error");
    expect(error).toHaveBeenCalled();
  });

  it("respeta un signal pre-abortado antes de hacer la petición", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    resetEnvCache();

    const chunks = ['data: {"choices": [{"delta": {"content": "uno"}}]}'];
    fetchSpy.mockResolvedValue(createSSEResponse(chunks));

    const provider = new OpenRouterProvider();
    const { stream, done } = await provider.reply({ ...input, signal: AbortSignal.abort() });

    expect(await readAll(stream)).toBe("");
    const result = await done;
    expect(result.stopReason).toBe("error");
    expect(error).not.toHaveBeenCalled();
  });

  it("ignora líneas SSE malformadas y continúa procesando", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    resetEnvCache();

    const chunks = [
      'data: {"choices": [{"delta": {"content": "ok"}}]}',
      'data: {invalid json}',
      'data: {"choices": [{"delta": {"content": "."}}]}',
    ];
    fetchSpy.mockResolvedValue(createSSEResponse(chunks));

    const provider = new OpenRouterProvider();
    const { stream, done } = await provider.reply(input);
    expect(await readAll(stream)).toBe("ok.");

    await done;
    expect(error).toHaveBeenCalled();
  });

  it("emite deltas en orden y no repite", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    resetEnvCache();

    // Cada trozo es largo: el arranque se retiene hasta 60 caracteres para descartar razonamiento filtrado.
    const a = "a".repeat(40);
    const b = "b".repeat(40);
    const c = "c".repeat(40);
    const chunks = [
      `data: {"choices": [{"delta": {"content": "${a}"}}]}`,
      `data: {"choices": [{"delta": {"content": "${b}"}}]}`,
      `data: {"choices": [{"delta": {"content": "${c}"}}]}`,
    ];
    fetchSpy.mockResolvedValue(createSSEResponse(chunks));

    const provider = new OpenRouterProvider();
    const { stream } = await provider.reply(input);

    const reader = stream.getReader();
    const results: string[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      results.push(value);
    }

    // El arranque retenido sale junto; el resto sigue en streaming, en orden y sin repetir.
    expect(results.join("")).toBe(a + b + c);
    expect(results.length).toBeGreaterThan(1);
  });

  it("detecta [DONE] y termina", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    resetEnvCache();

    const chunks = [
      'data: {"choices": [{"delta": {"content": "Listo"}}]}',
      'data: {"choices": [{"delta": {"content": "."}}]}',
    ];
    fetchSpy.mockResolvedValue(createSSEResponse(chunks));

    const provider = new OpenRouterProvider();
    const { stream, done } = await provider.reply(input);
    expect(await readAll(stream)).toBe("Listo.");

    const result = await done;
    expect(result.stopReason).toBe("end_turn");
  });

  it("T-051: identifica el modelo de visión del entorno", () => {
    const provider = new OpenRouterProvider({ env: getEnv() });
    expect(provider.visionModel).toBe("google/gemma-4-31b-it:free");
  });

  it("T-051: con imagen en el último turno, usa OPENROUTER_VISION_MODEL y content multimodal", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    resetEnvCache();
    fetchSpy.mockResolvedValue(
      createSSEResponse(['data: {"choices": [{"delta": {"content": "Veo la foto"}}]}']),
    );

    const withImage: TutorReplyInput = {
      ...input,
      messages: [
        ...input.messages.slice(0, -1),
        {
          role: "user",
          content: "me trabé en el denominador",
          images: [{ mediaType: "image/png", data: "ZmFrZQ==" }],
        },
      ],
    };
    const provider = new OpenRouterProvider();
    const { stream, done } = await provider.reply(withImage);
    expect(await readAll(stream)).toBe("Veo la foto");
    expect((await done).model).toBe("google/gemma-4-31b-it:free");

    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(body.model).toBe("google/gemma-4-31b-it:free");
    expect(body.messages.at(-1)).toEqual({
      role: "user",
      content: [
        { type: "text", text: "me trabé en el denominador" },
        { type: "image_url", image_url: { url: "data:image/png;base64,ZmFrZQ==" } },
      ],
    });
    // Los turnos sin imagen siguen siendo texto plano (tras los dos mensajes de sistema).
    expect(body.messages[2]).toEqual({ role: "user", content: input.messages[0].content });
  });

  it("T-051: con OPENROUTER_FALLBACK_MODEL, reintenta una vez si el modelo principal falla antes de emitir texto", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    process.env.OPENROUTER_FALLBACK_MODEL = "inclusionai/ling-3.0-flash:free";
    resetEnvCache();

    fetchSpy
      .mockResolvedValueOnce(new Response("Rate limited", { status: 429 }))
      .mockResolvedValueOnce(createSSEResponse(['data: {"choices": [{"delta": {"content": "ok"}}]}']));

    const provider = new OpenRouterProvider();
    const { stream, done } = await provider.reply(input);
    expect(await readAll(stream)).toBe("ok");
    expect((await done).model).toBe("inclusionai/ling-3.0-flash:free");
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    const firstBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    const secondBody = JSON.parse(fetchSpy.mock.calls[1][1]?.body as string);
    expect(firstBody.model).toBe("nvidia/nemotron-3.5-lightning:free");
    expect(secondBody.model).toBe("inclusionai/ling-3.0-flash:free");
    // El primer intento falla en silencio y se reintenta; solo un fallo final se registra/avisa.
    expect(error).not.toHaveBeenCalled();
  });

  it("T-051: no reintenta con fallback si ya se había emitido texto antes del fallo", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    process.env.OPENROUTER_FALLBACK_MODEL = "inclusionai/ling-3.0-flash:free";
    resetEnvCache();

    // `pull` entrega el primer chunk y solo falla en la SEGUNDA lectura: `enqueue` seguido de
    // `error` en el mismo `start` descartaría el chunk (el stream quedaría en error antes de leerse).
    let delivered = false;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (!delivered) {
          delivered = true;
          controller.enqueue(
            new TextEncoder().encode(
              'data: {"choices": [{"delta": {"content": "Vamos a resolverlo paso a paso, empezando por los datos que tienes."}}]}\n',
            ),
          );
          return;
        }
        controller.error(new Error("conexión cortada"));
      },
    });
    fetchSpy.mockResolvedValue(new Response(body, { status: 200 }));

    const provider = new OpenRouterProvider();
    const { stream, done } = await provider.reply(input);
    expect(await readAll(stream)).toContain("Vamos a resolverlo");
    expect((await done).stopReason).toBe("error");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("T-051: no reintenta con fallback cuando la petición con imagen falla (el respaldo puede no ser multimodal)", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    process.env.OPENROUTER_FALLBACK_MODEL = "inclusionai/ling-3.0-flash:free";
    resetEnvCache();
    fetchSpy.mockResolvedValue(new Response("Rate limited", { status: 429 }));

    const withImage: TutorReplyInput = {
      ...input,
      messages: [
        ...input.messages.slice(0, -1),
        {
          role: "user",
          content: "mira mi foto",
          images: [{ mediaType: "image/png", data: "ZmFrZQ==" }],
        },
      ],
    };
    const provider = new OpenRouterProvider();
    const { stream, done } = await provider.reply(withImage);
    await readAll(stream);
    await done;
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("con finalize_reason null, mapea a end_turn", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    resetEnvCache();

    const chunks = [
      'data: {"choices": [{"delta": {"content": "Text"}, "finish_reason": null}]}',
    ];
    fetchSpy.mockResolvedValue(createSSEResponse(chunks));

    const provider = new OpenRouterProvider();
    const { stream, done } = await provider.reply(input);
    await readAll(stream);

    const result = await done;
    expect(result.stopReason).toBe("end_turn");
  });
});
