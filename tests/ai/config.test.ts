import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyAiConfigOverrides, describeEffectiveAiConfig } from "@/lib/ai/config";
import { getProviderWithOverrides, resetAiConfigOverridesCache, resetProviderCache } from "@/lib/ai/providers";
import { getRepo, resetRepo } from "@/lib/db";
import { getEnv, resetEnvCache } from "@/lib/env";
import { GET as healthGET } from "@/app/api/health/route";

const ENV_KEYS = ["AI_PROVIDER", "ANTHROPIC_API_KEY", "OPENROUTER_API_KEY"];

function reset() {
  for (const key of ENV_KEYS) delete process.env[key];
  resetEnvCache();
  resetRepo();
  resetProviderCache();
  resetAiConfigOverridesCache();
}

describe("applyAiConfigOverrides / describeEffectiveAiConfig", () => {
  beforeEach(reset);
  afterEach(reset);

  it("sin overrides devuelve los valores de las env vars", () => {
    const effective = describeEffectiveAiConfig(getEnv(), {});
    expect(effective.provider).toBe("mock");
    expect(effective.activeModel).toBe("eli-mock");
    expect(effective.values.ANTHROPIC_MODEL).toBe("claude-fable-5-1");
  });

  it("el modelo activo es el del proveedor activo", () => {
    process.env.OPENROUTER_API_KEY = "k";
    resetEnvCache();
    const overrides = { OPENROUTER_MODEL: "vendor/model", ANTHROPIC_MODEL: "claude-sonnet-5" };
    expect(describeEffectiveAiConfig(getEnv(), overrides).activeModel).toBe("vendor/model");
    expect(describeEffectiveAiConfig(getEnv(), { ...overrides, AI_PROVIDER: "anthropic" }).activeModel).toBe(
      "claude-sonnet-5",
    );
  });

  it("ignora un override de AI_PROVIDER inválido ya guardado en app_config", () => {
    const env = applyAiConfigOverrides(getEnv(), { AI_PROVIDER: "gpt-4" });
    expect(env.AI_PROVIDER).toBeUndefined();
    expect(describeEffectiveAiConfig(getEnv(), { AI_PROVIDER: "gpt-4" }).provider).toBe("mock");
  });

  it("getProviderWithOverrides no rompe el chat con un AI_PROVIDER inválido guardado", async () => {
    await getRepo().setAiConfig("AI_PROVIDER", "gpt-4", "admin@eli.ngo");
    const provider = await getProviderWithOverrides(getEnv());
    expect(provider.name).toBe("mock");
  });
});

describe("GET /api/health con overrides de /admin", () => {
  beforeEach(reset);
  afterEach(reset);

  it("informa del modelo que realmente atiende el chat", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    resetEnvCache();
    await getRepo().setAiConfig("ANTHROPIC_MODEL", "claude-sonnet-5", "admin@eli.ngo");

    const body = await (await healthGET()).json();
    expect(body.provider).toBe("anthropic");
    expect(body.model).toBe("claude-sonnet-5");
  });
});
