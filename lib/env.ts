import { z } from "zod";

/**
 * Variables de entorno de ELI. Todas tienen valor por defecto o fallback local:
 * el proyecto debe funcionar sin ninguna clave (AI_PROVIDER=mock).
 * Fuente de verdad de la lista: tasks.md, sección 6.6.
 */
const boolish = z
  .enum(["true", "false"])
  .default("false")
  .transform((v) => v === "true");

const positiveInt = (fallback: number) => z.coerce.number().int().positive().default(fallback);

export const envSchema = z.object({
  AI_PROVIDER: z.enum(["anthropic", "openrouter", "mock"]).optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-fable-5-1"),
  ANTHROPIC_EFFORT: z.enum(["low", "medium", "high"]).default("low"),
  ANTHROPIC_FALLBACK_MODEL: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().default("anthropic/claude-fable-5.1"),
  AI_MAX_OUTPUT_TOKENS: positiveInt(1024),
  AI_WINDOW_PAIRS: z.coerce.number().int().min(0).default(6),
  AI_MAX_INPUT_CHARS: positiveInt(1000),
  MOCK_DELAY_MS: z.coerce.number().int().min(0).default(30),
  DATABASE_URL: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  RATE_LIMIT_MAX: positiveInt(20),
  RATE_LIMIT_WINDOW: z.string().default("10 m"),
  QSTASH_TOKEN: z.string().optional(),
  QSTASH_CURRENT_SIGNING_KEY: z.string().optional(),
  QSTASH_NEXT_SIGNING_KEY: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  AUTH_REQUIRED: boolish,
  DAILY_TOKEN_BUDGET: positiveInt(2_000_000),
  NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:3000"),
});

export type Env = z.infer<typeof envSchema>;
export type ProviderName = "anthropic" | "openrouter" | "mock";

let cached: Env | null = null;

/** Lee y valida process.env una vez. Las cadenas vacías cuentan como no definidas. */
export function getEnv(): Env {
  if (cached) return cached;
  const raw = Object.fromEntries(
    Object.entries(process.env).filter(([, v]) => v !== undefined && v !== ""),
  );
  cached = envSchema.parse(raw);
  return cached;
}

/** Proveedor efectivo: explícito por AI_PROVIDER o deducido de las claves presentes. */
export function resolveProvider(env: Env = getEnv()): ProviderName {
  if (env.AI_PROVIDER) return env.AI_PROVIDER;
  if (env.ANTHROPIC_API_KEY) return "anthropic";
  if (env.OPENROUTER_API_KEY) return "openrouter";
  return "mock";
}

/** Solo para tests: descarta la caché para releer process.env. */
export function resetEnvCache(): void {
  cached = null;
}
