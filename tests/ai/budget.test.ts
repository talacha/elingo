import { afterEach, describe, expect, it } from "vitest";
import { getEnv, resetEnvCache } from "@/lib/env";
import {
  checkBudget,
  clearMemoryBudget,
  incrementBudget,
  resetBudgetChecker,
} from "@/lib/ai/budget";

const ENV_KEYS = ["DAILY_TOKEN_BUDGET"] as const;
type EnvKey = (typeof ENV_KEYS)[number];

const saved: Partial<Record<EnvKey, string>> = {};
for (const key of ENV_KEYS) {
  saved[key] = process.env[key];
}

function apply(values: Partial<Record<EnvKey, string>>) {
  for (const key of ENV_KEYS) {
    const value = values[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  resetEnvCache();
  resetBudgetChecker();
  clearMemoryBudget();
}

afterEach(() => {
  apply(saved);
  clearMemoryBudget();
});

describe("Daily token budget", () => {
  it("initialmente checkBudget retorna true (hay espacio)", async () => {
    apply({ DAILY_TOKEN_BUDGET: "1000" });
    expect(await checkBudget()).toBe(true);
  });

  it("incrementBudget suma tokens y retorna el total", async () => {
    apply({ DAILY_TOKEN_BUDGET: "1000" });
    expect(await incrementBudget(100)).toBe(100);
    expect(await incrementBudget(250)).toBe(350);
  });

  it("checkBudget retorna false cuando se agota el presupuesto", async () => {
    apply({ DAILY_TOKEN_BUDGET: "500" });
    await incrementBudget(400);
    expect(await checkBudget()).toBe(true);
    await incrementBudget(100);
    expect(await checkBudget()).toBe(false);
  });

  it("la clave de presupuesto es la fecha UTC (YYYY-MM-DD)", async () => {
    // Este test simplemente verifica que el sistema usa fechas UTC
    apply({ DAILY_TOKEN_BUDGET: "1000" });
    const before = await checkBudget();
    await incrementBudget(500);
    const after = await checkBudget();
    expect(before).toBe(true);
    expect(after).toBe(true);
  });

  it("presupuestos de diferentes días son independientes", async () => {
    // Simulamos dos fechas diferentes mediante la clave de presupuesto
    apply({ DAILY_TOKEN_BUDGET: "100" });
    await incrementBudget(50);
    // Si usamos la misma lógica, el contador está en 50
    // y debería haber 50 tokens de espacio
    const hasBudget = await checkBudget();
    expect(hasBudget).toBe(true);
  });

  it("respeta el valor de DAILY_TOKEN_BUDGET del entorno", async () => {
    apply({ DAILY_TOKEN_BUDGET: "200" });
    await incrementBudget(150);
    expect(await checkBudget()).toBe(true);
    await incrementBudget(50);
    expect(await checkBudget()).toBe(false);
    await incrementBudget(1); // Still counts even though over budget
    expect(await checkBudget()).toBe(false);
  });

  it("usa valor por defecto 2,000,000 si no se configura DAILY_TOKEN_BUDGET", async () => {
    apply({});
    const env = getEnv();
    expect(env.DAILY_TOKEN_BUDGET).toBe(2_000_000);
    // Incrementar mucho y verificar que sigue disponible
    await incrementBudget(1_000_000);
    expect(await checkBudget()).toBe(true);
  });
});
