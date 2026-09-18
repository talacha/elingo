import { describe, expect, it } from "vitest";
import { hashSafeWord, verifySafeWord } from "@/lib/auth/safeWord";

describe("safeWord", () => {
  it("verifica la palabra correcta y rechaza una incorrecta", async () => {
    const hash = await hashSafeWord("mariposa azul");
    expect(await verifySafeWord("mariposa azul", hash)).toBe(true);
    expect(await verifySafeWord("otra cosa", hash)).toBe(false);
  });

  it("es insensible a mayúsculas y a espacios al principio/final", async () => {
    const hash = await hashSafeWord("Mariposa Azul");
    expect(await verifySafeWord("mariposa azul", hash)).toBe(true);
    expect(await verifySafeWord("  MARIPOSA AZUL  ", hash)).toBe(true);
  });

  it("dos hashes de la misma palabra son distintos (sal aleatoria) pero ambos verifican", async () => {
    const h1 = await hashSafeWord("secreto");
    const h2 = await hashSafeWord("secreto");
    expect(h1).not.toBe(h2);
    expect(await verifySafeWord("secreto", h1)).toBe(true);
    expect(await verifySafeWord("secreto", h2)).toBe(true);
  });

  it("nunca lanza ante un hash guardado con formato inesperado", async () => {
    await expect(verifySafeWord("cualquiera", "no-tiene-dos-puntos")).resolves.toBe(false);
    await expect(verifySafeWord("cualquiera", "")).resolves.toBe(false);
    await expect(verifySafeWord("cualquiera", "zzz:zzz")).resolves.toBe(false);
  });
});
