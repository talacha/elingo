import type { AdminEffectiveAiConfig, AiConfigKey } from "@/lib/contracts/admin";
import { PROVIDER_NAMES } from "@/lib/contracts/admin";
import { MOCK_MODEL } from "@/lib/ai/providers/mock";
import { resolveProvider, type Env } from "@/lib/env";

export type AiConfigOverrides = Partial<Record<AiConfigKey, string>>;

/**
 * Env efectivo: las env vars con los overrides de /admin (`app_config`) por encima. Un override de
 * `AI_PROVIDER` que no sea un proveedor conocido se ignora (nunca deja al chat sin proveedor).
 */
export function applyAiConfigOverrides(env: Env, overrides: AiConfigOverrides): Env {
  const provider = PROVIDER_NAMES.find((name) => name === overrides.AI_PROVIDER);
  return {
    ...env,
    ...(provider ? { AI_PROVIDER: provider } : {}),
    ...(overrides.ANTHROPIC_MODEL ? { ANTHROPIC_MODEL: overrides.ANTHROPIC_MODEL } : {}),
    ...(overrides.OPENROUTER_MODEL ? { OPENROUTER_MODEL: overrides.OPENROUTER_MODEL } : {}),
  };
}

/** Lo que /admin muestra como «activo»: proveedor, modelo de cada proveedor y el que atiende el chat. */
export function describeEffectiveAiConfig(env: Env, overrides: AiConfigOverrides): AdminEffectiveAiConfig {
  const effective = applyAiConfigOverrides(env, overrides);
  const provider = resolveProvider(effective);
  const activeModel =
    provider === "anthropic"
      ? effective.ANTHROPIC_MODEL
      : provider === "openrouter"
        ? effective.OPENROUTER_MODEL
        : MOCK_MODEL;
  return {
    provider,
    activeModel,
    values: {
      AI_PROVIDER: provider,
      ANTHROPIC_MODEL: effective.ANTHROPIC_MODEL,
      OPENROUTER_MODEL: effective.OPENROUTER_MODEL,
    },
  };
}
