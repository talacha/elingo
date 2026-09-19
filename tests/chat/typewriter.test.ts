import { describe, expect, it } from "vitest";
import { THINKING_PHRASES } from "@/components/chat/thinkingPhrases";
import {
  BLINK_COUNT,
  BLINK_CYCLE_MS,
  DELETE_MS,
  delayFor,
  INITIAL_STATE,
  step,
  TYPE_MS,
  type TypewriterState,
} from "@/components/chat/typewriter";

const LENGTHS = [3, 2, 4];

describe("ritmo del efecto", () => {
  it("escribir es rápido y borrar todavía más", () => {
    expect(TYPE_MS).toBeLessThanOrEqual(50);
    expect(DELETE_MS).toBeLessThan(TYPE_MS);
  });

  it("el cursor parpadea 3 veces antes de borrar", () => {
    expect(BLINK_COUNT).toBe(3);
    expect(delayFor("holding")).toBe(BLINK_CYCLE_MS * 3);
    expect(delayFor("typing")).toBe(TYPE_MS);
    expect(delayFor("deleting")).toBe(DELETE_MS);
  });

  it("la frase más larga se escribe y se borra en menos de 3 segundos (sin contar los parpadeos)", () => {
    const longest = Math.max(...THINKING_PHRASES.map((p) => p.text.length));
    expect(longest * (TYPE_MS + DELETE_MS)).toBeLessThan(3000);
  });
});

describe("step", () => {
  it("escribe una letra cada vez y, con la última, pasa a parpadear", () => {
    let s: TypewriterState = INITIAL_STATE;
    const seen: Array<[number, string]> = [];
    for (let i = 0; i < 3; i++) {
      s = step(s, LENGTHS);
      seen.push([s.shown, s.phase]);
    }
    expect(seen).toEqual([
      [1, "typing"],
      [2, "typing"],
      [3, "holding"],
    ]);
  });

  it("tras parpadear empieza a borrar sin tocar el texto", () => {
    expect(step({ index: 0, shown: 3, phase: "holding" }, LENGTHS)).toEqual({ index: 0, shown: 3, phase: "deleting" });
  });

  it("borra una letra cada vez y, al vaciarse, escribe otra frase distinta (nunca la primera)", () => {
    let s: TypewriterState = { index: 0, shown: 3, phase: "deleting" };
    s = step(s, LENGTHS, () => 0);
    expect(s).toEqual({ index: 0, shown: 2, phase: "deleting" });
    s = step(s, LENGTHS, () => 0);
    s = step(s, LENGTHS, () => 0);
    expect(s).toEqual({ index: 1, shown: 0, phase: "typing" });
  });

  it("recorre un ciclo completo: escribir, parpadear, borrar y siguiente frase", () => {
    let s: TypewriterState = INITIAL_STATE;
    const phases = new Set<string>();
    for (let i = 0; i < 100 && s.index === 0; i++) {
      phases.add(s.phase);
      s = step(s, LENGTHS, () => 0);
    }
    expect([...phases].sort()).toEqual(["deleting", "holding", "typing"]);
    expect(s).toEqual({ index: 1, shown: 0, phase: "typing" });
  });

  it("aguanta una frase vacía sin quedarse atascada", () => {
    expect(step({ index: 0, shown: 0, phase: "typing" }, [0, 2])).toEqual({ index: 0, shown: 0, phase: "holding" });
  });
});
