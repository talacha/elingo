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
  // Antes "anthropic/claude-fable-5.1": enrutaba a Fable vía OpenRouter, duplicando el coste de
  // Anthropic sin motivo. DeepSeek V4 Flash 0731 es gratis en OpenRouter (tasks.md 6.6/M6).
  OPENROUTER_MODEL: z.string().default("deepseek/deepseek-v4-flash-0731:free"),
  /** T-051: modelo con visión; se usa en vez de OPENROUTER_MODEL cuando el turno trae imágenes. */
  OPENROUTER_VISION_MODEL: z.string().default("inclusionai/ling-3.0-flash-vl:free"),
  /** T-051: si la petición al modelo principal falla, se reintenta una vez con este modelo. */
  OPENROUTER_FALLBACK_MODEL: z.string().optional(),
  /** T-052: modelo de transcripción, vía el endpoint dedicado /audio/transcriptions. */
  OPENROUTER_TRANSCRIBE_MODEL: z.string().default("openai/whisper-large-v3-turbo"),
  /** T-053: sin clave, /api/speech responde 204 y el cliente cae a speechSynthesis del navegador. */
  FISH_AUDIO_API_KEY: z.string().optional(),
  FISH_AUDIO_MODEL: z.string().default("s2.1-pro-free"),
  AI_MAX_OUTPUT_TOKENS: positiveInt(1024),
  AI_WINDOW_PAIRS: z.coerce.number().int().min(0).default(6),
  AI_MAX_INPUT_CHARS: positiveInt(1000),
  MOCK_DELAY_MS: z.coerce.number().int().min(0).default(30),
  DATABASE_URL: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  /** Nombres que instala «Upstash for Redis» (Marketplace de Vercel); equivalen a UPSTASH_REDIS_REST_*. */
  KV_REST_API_URL: z.string().optional(),
  KV_REST_API_TOKEN: z.string().optional(),
  RATE_LIMIT_MAX: positiveInt(20),
  RATE_LIMIT_WINDOW: z.string().default("10 m"),
  QSTASH_TOKEN: z.string().optional(),
  QSTASH_CURRENT_SIGNING_KEY: z.string().optional(),
  QSTASH_NEXT_SIGNING_KEY: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  AUTH_REQUIRED: boolish,
  /** M7: correos separados por comas con acceso a /admin; vacío por defecto → nadie. */
  ADMIN_EMAILS: z.string().optional(),
  DAILY_TOKEN_BUDGET: positiveInt(2_000_000),
  NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:3000"),
});

export type Env = z.infer<typeof envSchema>;
export type ProviderName = "anthropic" | "openrouter" | "mock";

let cached: Env | null = null;

/** Lee y valida process.env una vez. Las cadenas vacías cuentan como no definidas. */
export function getEnv(): Env {
  if (cached) return cached;
  const raw: Record<string, string> = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined && entry[1] !== "",
    ),
  );
  // La integración de Supabase del Marketplace de Vercel instala sus variables con
  // prefijo ELI_/NEXT_PUBLIC_ELI_ en vez de los nombres planos que lee este esquema
  // (mismo problema que eli_DATABASE_URL con Neon, ver tasks.md N-010). Caemos a esos
  // nombres del lado del servidor; lib/supabase/client.ts hace el equivalente para el
  // navegador, con acceso literal a process.env.NEXT_PUBLIC_* (Next.js solo inlinea
  // referencias literales, no una lectura dinámica de process.env como esta).
  raw.NEXT_PUBLIC_SUPABASE_URL ??= raw.NEXT_PUBLIC_ELI_SUPABASE_URL ?? raw.ELI_SUPABASE_URL;
  raw.NEXT_PUBLIC_SUPABASE_ANON_KEY ??=
    raw.NEXT_PUBLIC_ELI_SUPABASE_ANON_KEY ?? raw.ELI_SUPABASE_ANON_KEY;
  raw.SUPABASE_SERVICE_ROLE_KEY ??= raw.ELI_SUPABASE_SERVICE_ROLE_KEY;
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
