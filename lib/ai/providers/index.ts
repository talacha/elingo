import { AnthropicProvider } from "@/lib/ai/providers/anthropic";
import { MockProvider } from "@/lib/ai/providers/mock";
import type { TutorProvider } from "@/lib/contracts/ai";
import { getEnv, resolveProvider, type Env } from "@/lib/env";

export { AnthropicProvider } from "@/lib/ai/providers/anthropic";
export { MockProvider, MOCK_MODEL } from "@/lib/ai/providers/mock";

/**
 * Proveedor según el entorno (tasks.md 6.2): `AI_PROVIDER` explícito; si no, `anthropic` con
 * `ANTHROPIC_API_KEY`, `openrouter` solo con `OPENROUTER_API_KEY`, y `mock` en cualquier otro caso.
 * OpenRouter llega en T-019: hasta entonces cae al mock con un aviso.
 */
export function createProvider(env: Env = getEnv()): TutorProvider {
  switch (resolveProvider(env)) {
    case "anthropic":
      return new AnthropicProvider({ env });
    case "openrouter":
      console.warn("[ai] El proveedor openrouter llega en T-019; de momento se usa el mock.");
      return new MockProvider({ env });
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
