import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { REFUSAL_MESSAGE } from "@/lib/ai/prompt";
import {
  AnthropicProvider,
  getProvider,
  MockProvider,
  OpenRouterProvider,
  resetProviderCache,
} from "@/lib/ai/providers";
import { createTutorStream, ZERO_USAGE } from "@/lib/ai/providers/stream";
import { streamTutorReply, TutorInputError } from "@/lib/ai/service";
import type { TutorProvider, TutorReplyInput, TutorTurn } from "@/lib/contracts/ai";
import { getRepo, resetRepo } from "@/lib/db";
import { resetEnvCache } from "@/lib/env";
import { resetSettingsCache } from "@/lib/settings";

const ENV_KEYS = ["AI_PROVIDER", "ANTHROPIC_API_KEY", "OPENROUTER_API_KEY", "AI_WINDOW_PAIRS"];

async function readAll(stream: ReadableStream<string>): Promise<string> {
  const reader = stream.getReader();
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return text;
    text += value;
  }
}

/** Historial u1,a1,…,uN,aN más la pregunta pendiente uN+1. */
function history(pairs: number): TutorTurn[] {
  const turns: TutorTurn[] = [];
  for (let i = 1; i <= pairs; i++) {
    turns.push({ role: "user", content: `u${i}` }, { role: "assistant", content: `a${i}` });
  }
  turns.push({ role: "user", content: `u${pairs + 1}` });
  return turns;
}

/** Proveedor falso que graba la entrada y responde con lo que se le indique. */
function fakeProvider(
  script: { text?: string[]; stopReason?: "end_turn" | "refusal" | "error" } = {},
): TutorProvider & { inputs: TutorReplyInput[] } {
  return {
    name: "mock",
    model: "fake-model",
    inputs: [],
    async reply(input) {
      this.inputs.push(input);
      return createTutorStream({
        provider: "mock",
        model: "fake-model",
        signal: input.signal,
        produce: async (handle) => {
          for (const delta of script.text ?? ["hola"]) handle.emit(delta);
          return {
            usage: { ...ZERO_USAGE, outputTokens: 3 },
            model: "fake-model",
            stopReason: script.stopReason ?? "end_turn",
          };
        },
      });
    },
  };
}

const SESSION = "22222222-2222-4222-8222-222222222222";

describe("streamTutorReply", () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
    resetEnvCache();
    resetProviderCache();
  });

  it("sin claves usa el mock y devuelve { stream, done } del contrato", async () => {
    const { stream, done } = await streamTutorReply({
      sessionId: SESSION,
      subject: "mates",
      messages: [{ role: "user", content: "Tengo este problema: 3/4 + 1/2" }],
    });
    const text = await readAll(stream);
    expect(text).toMatch(/\*\*/);
    const result = await done;
    expect(result).toMatchObject({ stopReason: "end_turn", model: "eli-mock" });
    expect(result.usage.outputTokens).toBeGreaterThan(0);
    expect(typeof result.latencyMs).toBe("number");
    expect(typeof result.ttfbMs).toBe("number");
  });

  it("aplica la ventana deslizante (AI_WINDOW_PAIRS) antes de llamar al proveedor", async () => {
    const provider = fakeProvider();
    await streamTutorReply({ sessionId: SESSION, messages: history(10) }, { provider });
    expect(provider.inputs[0].messages.map((turn) => turn.content)).toEqual([
      "u5",
      "a5",
      "u6",
      "a6",
      "u7",
      "a7",
      "u8",
      "a8",
      "u9",
      "a9",
      "u10",
      "a10",
      "u11",
    ]);

    process.env.AI_WINDOW_PAIRS = "1";
    resetEnvCache();
    await streamTutorReply({ sessionId: SESSION, messages: history(10) }, { provider });
    expect(provider.inputs[1].messages.map((turn) => turn.content)).toEqual(["u10", "a10", "u11"]);
  });

  it("pasa sessionId, subject y signal al proveedor y descarta los turnos en blanco", async () => {
    const provider = fakeProvider();
    const controller = new AbortController();
    await streamTutorReply(
      {
        sessionId: SESSION,
        subject: "lengua",
        signal: controller.signal,
        messages: [
          { role: "user", content: "   " },
          { role: "assistant", content: "" },
          { role: "user", content: "¿Qué es un sujeto?" },
        ],
      },
      { provider },
    );
    expect(provider.inputs[0]).toMatchObject({ sessionId: SESSION, subject: "lengua" });
    expect(provider.inputs[0].signal).toBe(controller.signal);
    expect(provider.inputs[0].messages).toEqual([{ role: "user", content: "¿Qué es un sujeto?" }]);
  });

  it("rechaza con TutorInputError si no queda un último turno de la alumna", async () => {
    const provider = fakeProvider();
    await expect(
      streamTutorReply({ sessionId: SESSION, messages: [] }, { provider }),
    ).rejects.toBeInstanceOf(TutorInputError);
    await expect(
      streamTutorReply(
        { sessionId: SESSION, messages: [{ role: "user", content: " \n " }] },
        { provider },
      ),
    ).rejects.toBeInstanceOf(TutorInputError);
    await expect(
      streamTutorReply(
        {
          sessionId: SESSION,
          messages: [
            { role: "user", content: "hola" },
            { role: "assistant", content: "¡Hola!" },
          ],
        },
        { provider },
      ),
    ).rejects.toBeInstanceOf(TutorInputError);
    expect(provider.inputs).toHaveLength(0);
  });

  it("con un proveedor que rehúsa, el stream termina con REFUSAL_MESSAGE y done lo refleja", async () => {
    const provider = fakeProvider({ text: ["Vamos a ver…"], stopReason: "refusal" });
    const { stream, done } = await streamTutorReply(
      { sessionId: SESSION, messages: [{ role: "user", content: "algo que ELI no debe tratar" }] },
      { provider },
    );
    expect(await readAll(stream)).toBe(`Vamos a ver…\n\n${REFUSAL_MESSAGE}`);
    expect((await done).stopReason).toBe("refusal");
  });
});

describe("getProvider", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

  beforeEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
    resetEnvCache();
    resetProviderCache();
    warn.mockClear();
  });

  afterEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
    resetEnvCache();
    resetProviderCache();
    resetSettingsCache();
    resetRepo();
  });

  it("elige mock sin claves y anthropic con ANTHROPIC_API_KEY", async () => {
    expect(await getProvider()).toBeInstanceOf(MockProvider);

    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    resetEnvCache();
    const anthropic = await getProvider();
    expect(anthropic).toBeInstanceOf(AnthropicProvider);
    expect(anthropic.name).toBe("anthropic");
    expect(anthropic.model).toBe("claude-fable-5-1");
  });

  it("AI_PROVIDER explícito manda sobre las claves", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    process.env.AI_PROVIDER = "mock";
    resetEnvCache();
    expect(await getProvider()).toBeInstanceOf(MockProvider);
  });

  it("openrouter elige OpenRouterProvider con OPENROUTER_API_KEY", async () => {
    process.env.OPENROUTER_API_KEY = "sk-or-test";
    resetEnvCache();
    const provider = await getProvider();
    expect(provider).toBeInstanceOf(OpenRouterProvider);
    expect(provider.name).toBe("openrouter");
    expect(provider.model).toBe("anthropic/claude-fable-5.1");
  });

  it("openrouter usa el modelo de /admin (app_settings) si está puesto, si no el de env", async () => {
    process.env.OPENROUTER_API_KEY = "sk-or-test";
    resetEnvCache();
    resetSettingsCache();
    const repo = getRepo();
    await repo.setSetting("OPENROUTER_MODEL", "anthropic/claude-3.5-sonnet");
    resetProviderCache();
    const overridden = await getProvider();
    expect(overridden.model).toBe("anthropic/claude-3.5-sonnet");
  });

  it("memoiza la instancia por entorno", async () => {
    const first = await getProvider();
    expect(await getProvider()).toBe(first);
    resetEnvCache();
    expect(await getProvider()).not.toBe(first);
  });
});
