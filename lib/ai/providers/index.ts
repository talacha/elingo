import { AnthropicProvider } from "@/lib/ai/providers/anthropic";
import { MockProvider } from "@/lib/ai/providers/mock";
import { OpenRouterProvider } from "@/lib/ai/providers/openrouter";
import type { TutorProvider } from "@/lib/contracts/ai";
import { getEnv, resolveProvider, type Env } from "@/lib/env";
import { getSetting, SETTINGS_KEYS } from "@/lib/settings";

export { AnthropicProvider } from "@/lib/ai/providers/anthropic";
export { MockProvider, MOCK_MODEL } from "@/lib/ai/providers/mock";
export { OpenRouterProvider } from "@/lib/ai/providers/openrouter";

/**
 * Proveedor según el entorno (tasks.md 6.2): `AI_PROVIDER` explícito; si no, `anthropic` con
 * `ANTHROPIC_API_KEY`, `openrouter` con `OPENROUTER_API_KEY`, y `mock` en cualquier otro caso.
 * El modelo de OpenRouter admite un ajuste desde /admin (lib/settings.ts) por encima de
 * `OPENROUTER_MODEL`; los demás proveedores no tienen (todavía) ajustes dinámicos.
 */
export async function createProvider(env: Env = getEnv()): Promise<TutorProvider> {
  switch (resolveProvider(env)) {
    case "anthropic":
      return new AnthropicProvider({ env });
    case "openrouter": {
      const override = await getSetting(SETTINGS_KEYS.openRouterModel);
      return new OpenRouterProvider({
        env: override ? { ...env, OPENROUTER_MODEL: override } : env,
      });
    }
    case "mock":
      return new MockProvider({ env });
  }
}

interface CacheEntry {
  env: Env;
  model: string;
  provider: TutorProvider;
}
let cached: CacheEntry | null = null;

/**
 * Instancia única por entorno (reutiliza el cliente HTTP) mientras el modelo efectivo no cambie.
 * Para anthropic/mock esto es tan barato como antes (el ajuste de settings solo se comprueba
 * para openrouter, y esa comprobación ya tiene su propia caché de 30s). `resetEnvCache()` o
 * `resetProviderCache()` fuerzan otra instancia.
 */
export async function getProvider(env: Env = getEnv()): Promise<TutorProvider> {
  if (cached && cached.env === env && resolveProvider(env) !== "openrouter") {
    return cached.provider;
  }
  const provider = await createProvider(env);
  if (!cached || cached.env !== env || cached.model !== provider.model) {
    cached = { env, model: provider.model, provider };
  }
  return cached.provider;
}

/** Solo para tests. */
export function resetProviderCache(): void {
  cached = null;
}
