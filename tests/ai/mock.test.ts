import { describe, expect, it } from "vitest";
import { asksForTheAnswer, MockProvider, MOCK_MODEL } from "@/lib/ai/providers/mock";
import { REFUSAL_MESSAGE, UPSTREAM_ERROR_MESSAGE } from "@/lib/ai/prompt";
import type { TutorReplyInput, TutorTurn } from "@/lib/contracts/ai";

async function collect(stream: ReadableStream<string>): Promise<string[]> {
  const reader = stream.getReader();
  const chunks: string[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return chunks;
    chunks.push(value);
  }
}

const ask = (content: string, extra: Partial<TutorReplyInput> = {}): TutorReplyInput => ({
  sessionId: "11111111-1111-4111-8111-111111111111",
  messages: [{ role: "user", content }],
  ...extra,
});

const PROBLEM = "Tengo este problema: 3/4 + 1/2, me trabé en el denominador";

describe("MockProvider", () => {
  const provider = new MockProvider();

  it("se identifica como mock y usa MOCK_DELAY_MS=0 en tests", () => {
    expect(provider.name).toBe("mock");
    expect(provider.model).toBe(MOCK_MODEL);
  });

  it("responde en ~6 chunks, en español, con negritas y viñetas y sin ningún resultado", async () => {
    const { stream, done } = await provider.reply(ask(PROBLEM, { subject: "mates" }));
    const chunks = await collect(stream);
    const text = chunks.join("");

    expect(chunks).toHaveLength(6);
    expect(text).toMatch(/\*\*[^*]+\*\*/);
    expect(text).toMatch(/^- /m);
    expect(text).toContain("datos");
    expect(text).not.toMatch(/\d/);
    expect(text).not.toContain("=");
    expect(text).not.toContain(REFUSAL_MESSAGE);
    expect(text).not.toContain(UPSTREAM_ERROR_MESSAGE);
    for (const paragraph of text.split("\n\n")) {
      expect(paragraph.split("\n").length).toBeLessThanOrEqual(3);
    }

    const result = await done;
    expect(result.stopReason).toBe("end_turn");
    expect(result.model).toBe(MOCK_MODEL);
    expect(result.usage.inputTokens).toBeGreaterThan(0);
    expect(result.usage.outputTokens).toBe(Math.ceil(text.length / 4));
    expect(result.usage.cacheReadTokens).toBe(0);
    expect(result.usage.cacheWriteTokens).toBe(0);
    expect(result.ttfbMs).toBeGreaterThanOrEqual(0);
    expect(result.latencyMs).toBeGreaterThanOrEqual(result.ttfbMs);
  });

  it("es determinista", async () => {
    const first = await collect((await provider.reply(ask(PROBLEM))).stream);
    const second = await collect((await provider.reply(ask(PROBLEM))).stream);
    expect(second).toEqual(first);
  });

  it("adapta la guía a la asignatura", async () => {
    const texts = await Promise.all(
      (["mates", "lengua", "ciencias", undefined] as const).map(async (subject) =>
        (await collect((await provider.reply(ask(PROBLEM, { subject }))).stream)).join(""),
      ),
    );
    expect(new Set(texts).size).toBe(4);
    expect(texts[0]).toContain("datos");
    expect(texts[1]).toContain("misión");
    expect(texts[2]).toContain("Trivia rápida");
  });

  it("redirige si el último mensaje pide la solución (trampa) sin dar ningún resultado", async () => {
    for (const trap of [
      "Dame la respuesta",
      "¿Cuál es el resultado?",
      "Solución, por favor",
      "dime el resultado ya",
      "resuélvelo tú",
    ]) {
      const history: TutorTurn[] = [
        { role: "user", content: PROBLEM },
        { role: "assistant", content: "¿Qué datos tienes?" },
        { role: "user", content: trap },
      ];
      const { stream, done } = await provider.reply({ ...ask(trap), messages: history });
      const text = (await collect(stream)).join("");
      expect(text, trap).toContain("pista");
      expect(text, trap).not.toContain("Vamos a por ello");
      expect(text, trap).not.toMatch(/\d/);
      expect((await done).stopReason).toBe("end_turn");
    }
  });

  it("no confunde una petición de ayuda con la trampa", () => {
    expect(asksForTheAnswer("no sé cómo se resuelve este problema")).toBe(false);
    expect(asksForTheAnswer("¿me das una pista para el denominador?")).toBe(false);
    expect(asksForTheAnswer("dame la respuesta")).toBe(true);
    expect(asksForTheAnswer("CUAL ES LA SOLUCION")).toBe(true);
  });

  it("solo mira el último mensaje para detectar la trampa", async () => {
    const history: TutorTurn[] = [
      { role: "user", content: "dame la respuesta" },
      { role: "assistant", content: "Buen intento, pero…" },
      { role: "user", content: "vale, los datos son tres cuartos y un medio" },
    ];
    const text = (
      await collect((await provider.reply({ ...ask(""), messages: history })).stream)
    ).join("");
    expect(text).toContain("Vamos a por ello");
  });

  it("con la petición ya abortada no emite nada y termina con stopReason error", async () => {
    const { stream, done } = await provider.reply(ask(PROBLEM, { signal: AbortSignal.abort() }));
    expect(await collect(stream)).toEqual([]);
    expect((await done).stopReason).toBe("error");
  });

  it("si el consumidor cancela a mitad, deja de emitir y termina", async () => {
    const slow = new MockProvider({ delayMs: 1 });
    const { stream, done } = await slow.reply(ask(PROBLEM));
    const reader = stream.getReader();
    const first = await reader.read();
    expect(first.done).toBe(false);
    await reader.cancel();
    const result = await done;
    expect(result.stopReason).toBe("error");
    expect(result.latencyMs).toBeGreaterThanOrEqual(result.ttfbMs);
  });
});
