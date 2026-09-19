import { AnthropicProvider } from "@/lib/ai/providers/anthropic";
import { MockProvider } from "@/lib/ai/providers/mock";
import { OpenRouterProvider } from "@/lib/ai/providers/openrouter";
import { resetConfigCache } from "@/lib/config/cache";
import { getEffectiveEnv } from "@/lib/config/effective";
import { resetConfigStore } from "@/lib/config/store";
import type { TutorProvider } from "@/lib/contracts/ai";
import { getEnv, resolveProvider, type Env } from "@/lib/env";

export { AnthropicProvider } from "@/lib/ai/providers/anthropic";
export { MockProvider, MOCK_MODEL } from "@/lib/ai/providers/mock";
export { OpenRouterProvider } from "@/lib/ai/providers/openrouter";

/**
 * Proveedor según el entorno (tasks.md 6.2): `AI_PROVIDER` explícito; si no, `anthropic` con
 * `ANTHROPIC_API_KEY`, `openrouter` con `OPENROUTER_API_KEY`, y `mock` en cualquier otro caso.
 */
export function createProvider(env: Env = getEnv()): TutorProvider {
  switch (resolveProvider(env)) {
    case "anthropic":
      return new AnthropicProvider({ env });
    case "openrouter":
      return new OpenRouterProvider({ env });
    case "mock":
      return new MockProvider({ env });
  }
}

let cached: { env: Env; provider: TutorProvider } | null = null;

/** Instancia única por entorno (reutiliza el cliente HTTP). `resetEnvCache()` fuerza otra. */
export function getProvider(env: Env = getEnv()): TutorProvider {
  if (!cached || cached.env !== env) cached = { env, provider: createProvider(env) };
  return cached.provider;
}

/** Solo para tests. */
export function resetProviderCache(): void {
  cached = null;
}

let overriddenCache: { key: string; provider: TutorProvider } | null = null;

/**
 * Como `getProvider`, pero con la config guardada en Postgres (vía Redis) por encima de las env vars:
 * proveedor y modelos de /admin (lib/config). Sin ninguna fila aplicable, `getEffectiveEnv` devuelve
 * el mismo `env` y esto es exactamente `getProvider(env)`.
 */
export async function getProviderWithOverrides(env: Env = getEnv()): Promise<TutorProvider> {
  const effectiveEnv = await getEffectiveEnv(env);
  if (effectiveEnv === env) return getProvider(env);

  const key = JSON.stringify([
    effectiveEnv.AI_PROVIDER,
    effectiveEnv.ANTHROPIC_MODEL,
    effectiveEnv.OPENROUTER_MODEL,
    effectiveEnv.OPENROUTER_VISION_MODEL,
    effectiveEnv.OPENROUTER_FALLBACK_MODEL,
    effectiveEnv.AI_MAX_OUTPUT_TOKENS,
  ]);
  if (!overriddenCache || overriddenCache.key !== key) {
    overriddenCache = { key, provider: createProvider(effectiveEnv) };
  }
  return overriddenCache.provider;
}

/** Solo para tests: descarta las cachés de config y el proveedor construido con overrides. */
export function resetAiConfigOverridesCache(): void {
  resetConfigCache();
  resetConfigStore();
  overriddenCache = null;
}
