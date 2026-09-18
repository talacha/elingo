import { afterEach, describe, expect, it } from "vitest";
import { slidingWindow } from "@/lib/ai/window";
import type { TutorTurn } from "@/lib/contracts/ai";
import { resetEnvCache } from "@/lib/env";

/** Historial u1,a1,…,uN,aN (N pares completos) más, si se pide, la pregunta pendiente uN+1. */
function history(pairs: number, pendingUser = true): TutorTurn[] {
  const turns: TutorTurn[] = [];
  for (let i = 1; i <= pairs; i++) {
    turns.push({ role: "user", content: `u${i}` }, { role: "assistant", content: `a${i}` });
  }
  if (pendingUser) turns.push({ role: "user", content: `u${pairs + 1}` });
  return turns;
}

const contents = (turns: readonly TutorTurn[]) => turns.map((turn) => turn.content);

describe("slidingWindow", () => {
  afterEach(() => {
    delete process.env.AI_WINDOW_PAIRS;
    resetEnvCache();
  });

  it("conserva los últimos N pares completos más la pregunta pendiente y descarta los más antiguos", () => {
    expect(contents(slidingWindow(history(10), 6))).toEqual([
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
    expect(contents(slidingWindow(history(3), 1))).toEqual(["u3", "a3", "u4"]);
  });

  it("usa AI_WINDOW_PAIRS por defecto (6 sin configurar)", () => {
    resetEnvCache();
    expect(slidingWindow(history(10))).toHaveLength(13);

    process.env.AI_WINDOW_PAIRS = "2";
    resetEnvCache();
    expect(contents(slidingWindow(history(5)))).toEqual(["u4", "a4", "u5", "a5", "u6"]);
  });

  it("con pairs = 0 deja solo el turno pendiente de la alumna", () => {
    expect(contents(slidingWindow(history(3), 0))).toEqual(["u4"]);
    expect(slidingWindow(history(3, false), 0)).toEqual([]);
    expect(contents(slidingWindow([{ role: "user", content: "hola" }], 0))).toEqual(["hola"]);
  });

  it("devuelve intactas las listas cortas y la lista vacía", () => {
    const short = history(2);
    expect(slidingWindow(short, 6)).toEqual(short);
    expect(slidingWindow(history(6), 6)).toEqual(history(6));
    expect(slidingWindow([], 6)).toEqual([]);
    expect(slidingWindow([], 0)).toEqual([]);
  });

  it("empieza siempre por user: descarta los assistant iniciales sin pregunta", () => {
    const greeting: TutorTurn = { role: "assistant", content: "¡Hola! Soy ELI" };
    expect(contents(slidingWindow([greeting, ...history(1)], 6))).toEqual(["u1", "a1", "u2"]);
    expect(slidingWindow([greeting], 6)).toEqual([]);
    expect(slidingWindow([greeting, greeting], 0)).toEqual([]);
  });

  it("si la lista termina en assistant, conserva exactamente los últimos N pares", () => {
    expect(contents(slidingWindow(history(4, false), 2))).toEqual(["u3", "a3", "u4", "a4"]);
    expect(contents(slidingWindow(history(4, false), 1))).toEqual(["u4", "a4"]);
  });

  it("agrupa los mensajes seguidos del mismo rol dentro del mismo par", () => {
    const turns: TutorTurn[] = [
      { role: "user", content: "u1" },
      { role: "assistant", content: "a1" },
      { role: "user", content: "u2" },
      { role: "user", content: "u2b" },
      { role: "assistant", content: "a2" },
      { role: "assistant", content: "a2b" },
      { role: "user", content: "u3" },
    ];
    expect(contents(slidingWindow(turns, 1))).toEqual(["u2", "u2b", "a2", "a2b", "u3"]);
    expect(contents(slidingWindow(turns, 0))).toEqual(["u3"]);
    expect(contents(slidingWindow(turns, 2))).toEqual(contents(turns));
  });

  it("devuelve los mismos objetos (campos extra incluidos) sin mutar la entrada", () => {
    type Stored = TutorTurn & { id: string };
    const turns: Stored[] = [
      { id: "1", role: "user", content: "u1" },
      { id: "2", role: "assistant", content: "a1" },
      { id: "3", role: "user", content: "u2" },
      { id: "4", role: "assistant", content: "a2" },
      { id: "5", role: "user", content: "u3" },
    ];
    const snapshot = turns.map((turn) => ({ ...turn }));

    const out = slidingWindow(turns, 1);

    expect(out.map((turn) => turn.id)).toEqual(["3", "4", "5"]);
    expect(out[0]).toBe(turns[2]);
    expect(out).not.toBe(turns);
    expect(turns).toEqual(snapshot);
  });

  it("rechaza pairs negativos o no enteros", () => {
    expect(() => slidingWindow(history(1), -1)).toThrow(RangeError);
    expect(() => slidingWindow(history(1), 1.5)).toThrow(RangeError);
    expect(() => slidingWindow(history(1), Number.NaN)).toThrow(RangeError);
  });
});
