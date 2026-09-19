import { AnthropicProvider } from "@/lib/ai/providers/anthropic";
import { MockProvider } from "@/lib/ai/providers/mock";
import { OpenRouterProvider } from "@/lib/ai/providers/openrouter";
import { applyAiConfigOverrides, type AiConfigOverrides } from "@/lib/ai/config";
import type { TutorProvider } from "@/lib/contracts/ai";
import { getRepo } from "@/lib/db";
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

/**
 * M7 (T-067): config de IA en caliente desde /admin (`app_config`), por encima de las env vars.
 * No toca `getProvider`/`createProvider` (siguen usándose tal cual en todos los tests y llamadores
 * existentes) — es una capa aparte que solo entra en juego cuando un admin ha cambiado algo.
 */
let overridesCache: { value: AiConfigOverrides; expiresAt: number } | null = null;
const OVERRIDES_TTL_MS = 30_000;

/** Overrides vigentes de /admin, con caché corta de proceso y fallback silencioso a `{}`. */
export async function getAiConfigOverrides(): Promise<AiConfigOverrides> {
  if (overridesCache && overridesCache.expiresAt > Date.now()) return overridesCache.value;
  try {
    const value = await getRepo().getAiConfig();
    overridesCache = { value, expiresAt: Date.now() + OVERRIDES_TTL_MS };
    return value;
  } catch (error) {
    // Sin `app_config` (p. ej. MemoryRepo, o Neon caído): se comporta como si no hubiera overrides.
    console.error("[ai/providers] no se pudo leer app_config, usando solo env vars", error);
    return overridesCache?.value ?? {};
  }
}

let overriddenCache: { key: string; provider: TutorProvider } | null = null;

/**
 * Como `getProvider`, pero consulta primero los overrides de /admin. Sin ningún override activo
 * (el caso normal), delega en `getProvider(env)` sin ningún cambio de comportamiento ni de caché.
 */
export async function getProviderWithOverrides(env: Env = getEnv()): Promise<TutorProvider> {
  const overrides = await getAiConfigOverrides();
  if (Object.keys(overrides).length === 0) return getProvider(env);

  const effectiveEnv = applyAiConfigOverrides(env, overrides);
  const key = JSON.stringify([effectiveEnv.AI_PROVIDER, effectiveEnv.ANTHROPIC_MODEL, effectiveEnv.OPENROUTER_MODEL]);
  if (!overriddenCache || overriddenCache.key !== key) {
    overriddenCache = { key, provider: createProvider(effectiveEnv) };
  }
  return overriddenCache.provider;
}

/** Descarta las cachés de overrides: /admin lo llama tras guardar; también sirve a los tests. */
export function resetAiConfigOverridesCache(): void {
  overridesCache = null;
  overriddenCache = null;
}
