import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getProviderWithOverrides,
  resetAiConfigOverridesCache,
  resetProviderCache,
} from "@/lib/ai/providers";
import { AnthropicProvider } from "@/lib/ai/providers/anthropic";
import { OpenRouterProvider } from "@/lib/ai/providers/openrouter";
import { resetRepo } from "@/lib/db";
import { getEnv, resetEnvCache } from "@/lib/env";

const ENV_KEYS = ["AI_PROVIDER", "ANTHROPIC_API_KEY", "OPENROUTER_API_KEY", "ANTHROPIC_MODEL"];

describe("T-067: getProviderWithOverrides", () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
    resetEnvCache();
    resetRepo();
    resetProviderCache();
    resetAiConfigOverridesCache();
  });

  afterEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
    resetEnvCache();
    resetRepo();
    resetProviderCache();
    resetAiConfigOverridesCache();
  });

  it("sin overrides en app_config, se comporta exactamente como getProvider (mock por defecto)", async () => {
    const provider = await getProviderWithOverrides(getEnv());
    expect(provider.name).toBe("mock");
  });

  it("un override de AI_PROVIDER cambia el proveedor activo aunque las claves apunten a otro", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    resetEnvCache();
    const { getRepo } = await import("@/lib/db");
    await getRepo().setAiConfig("AI_PROVIDER", "openrouter", "admin@eli.ngo");

    const provider = await getProviderWithOverrides(getEnv());
    expect(provider).toBeInstanceOf(OpenRouterProvider);
  });

  it("un override de ANTHROPIC_MODEL cambia el modelo sin tocar ANTHROPIC_MODEL en el entorno", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    process.env.AI_PROVIDER = "anthropic";
    resetEnvCache();
    const { getRepo } = await import("@/lib/db");
    await getRepo().setAiConfig("ANTHROPIC_MODEL", "claude-sonnet-5", "admin@eli.ngo");

    const provider = await getProviderWithOverrides(getEnv());
    expect(provider).toBeInstanceOf(AnthropicProvider);
    expect(provider.model).toBe("claude-sonnet-5");
    expect(getEnv().ANTHROPIC_MODEL).toBe("claude-fable-5-1");
  });

  it("si la lectura de app_config falla, degrada a getProvider(env) sin lanzar", async () => {
    const { getRepo } = await import("@/lib/db");
    const repo = getRepo();
    const original = repo.getAiConfig;
    repo.getAiConfig = () => Promise.reject(new Error("Neon caído"));
    try {
      const provider = await getProviderWithOverrides(getEnv());
      expect(provider.name).toBe("mock");
    } finally {
      repo.getAiConfig = original;
    }
  });
});
