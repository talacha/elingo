import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { nextPhraseIndex, PHRASE_INTERVAL_MS, THINKING_PHRASES } from "@/components/chat/thinkingPhrases";

describe("THINKING_PHRASES: texto apto para una niña de primaria", () => {
  it("la primera frase es siempre «ELI está pensando…»", () => {
    expect(THINKING_PHRASES[0]).toEqual({ text: "ELI está pensando…" });
  });

  it("hay variedad: al menos diez frases, todas distintas", () => {
    expect(THINKING_PHRASES.length).toBeGreaterThanOrEqual(10);
    expect(new Set(THINKING_PHRASES.map((p) => p.text)).size).toBe(THINKING_PHRASES.length);
  });

  it.each(THINKING_PHRASES.map((p) => [p.text, p] as const))("«%s» es corta, amable y termina en «…»", (_text, phrase) => {
    expect(phrase.text.endsWith("…")).toBe(true);
    expect(phrase.text.length).toBeLessThanOrEqual(45);
    // Sin negaciones ni prisa: nada que suene a error o a regaño.
    expect(phrase.text).not.toMatch(/\b(no puedo|error|fallo|lo siento|rápido|date prisa|espera)\b/i);
  });

  it("los adornos son emojis sueltos, fuera del texto", () => {
    for (const phrase of THINKING_PHRASES) {
      expect(phrase.text).not.toMatch(/\p{Extended_Pictographic}/u);
      if (phrase.emoji) expect(phrase.emoji).toMatch(/\p{Extended_Pictographic}/u);
    }
  });

  it("cada frase se queda unos segundos, lo bastante para leerla", () => {
    expect(PHRASE_INTERVAL_MS).toBeGreaterThanOrEqual(2000);
    expect(PHRASE_INTERVAL_MS).toBeLessThanOrEqual(5000);
  });
});

describe("nextPhraseIndex", () => {
  const count = THINKING_PHRASES.length;
  const seeded = (values: number[]) => {
    let i = 0;
    return () => values[i++ % values.length];
  };

  it("nunca repite la frase actual ni vuelve a la primera", () => {
    for (let current = 0; current < count; current++) {
      for (const r of [0, 0.1, 0.5, 0.9, 0.9999]) {
        const next = nextPhraseIndex(current, count, () => r);
        expect(next).not.toBe(current);
        expect(next).toBeGreaterThanOrEqual(1);
        expect(next).toBeLessThan(count);
      }
    }
  });

  it("con el azar real recorre todas las frases menos la primera, sin salirse de rango", () => {
    const seen = new Set<number>();
    let current = 0;
    for (let i = 0; i < 2000; i++) {
      current = nextPhraseIndex(current, count);
      seen.add(current);
    }
    expect([...seen].sort((a, b) => a - b)).toEqual(Array.from({ length: count - 1 }, (_, i) => i + 1));
  });

  it("es determinista con un azar fijo", () => {
    expect(nextPhraseIndex(0, count, seeded([0]))).toBe(1);
    expect(nextPhraseIndex(0, count, seeded([0.9999]))).toBe(count - 1);
    expect(nextPhraseIndex(1, count, seeded([0]))).toBe(2);
  });

  it("aguanta listas diminutas sin fallar", () => {
    expect(nextPhraseIndex(0, 1)).toBe(0);
    expect(nextPhraseIndex(0, 2)).toBe(1);
    expect(nextPhraseIndex(1, 2)).toBe(0);
    expect(nextPhraseIndex(0, 0)).toBe(0);
  });
});

describe("TypingIndicator", () => {
  const html = renderToStaticMarkup(<TypingIndicator />);

  it("empieza con «ELI está pensando…»", () => {
    expect(html).toContain("ELI está pensando…");
  });

  it("el lector de pantalla oye un texto fijo y la frase que rota es decorativa (aria-hidden)", () => {
    expect(html).toContain('role="status"');
    expect(html).toMatch(/<span class="sr-only">ELI está pensando<\/span>/);
    expect(html).toMatch(/aria-hidden="true"[^>]*animate-phrase-in/);
  });

  it("apaga el movimiento con «reducir movimiento»", () => {
    expect(html).toContain("motion-reduce:animate-none");
    expect(html).toContain("motion-reduce:bg-none");
  });

  it("mantiene los tres puntos que rebotan", () => {
    expect((html.match(/animate-bounce/g) || []).length).toBe(3);
  });
});
