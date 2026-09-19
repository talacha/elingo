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
  // Los modelos de OpenRouter son `base_model`, `visual_model`, `stt_model` y `tts_model` (+ voces y
  // respaldo) en lib/config/registry.ts, editables en caliente desde /admin. Elegidos con el catálogo
  // de OpenRouter delante: el modelo base es solo de texto (nemotron-3.5-lightning NO acepta imágenes
  // ni audio); el visual acepta imagen y vídeo; STT y TTS son categorías propias del catálogo
  // (`?output_modalities=transcription` / `speech`) con endpoints propios.
  OPENROUTER_MODEL: z.string().default("nvidia/nemotron-3.5-lightning:free"),
  /** T-051: modelo con visión (`visual_model`); se usa en vez de OPENROUTER_MODEL cuando el turno trae imágenes. Gratis. */
  OPENROUTER_VISION_MODEL: z.string().default("google/gemma-4-31b-it:free"),
  /**
   * `base_fallback_model`: si el modelo principal falla, no responde a tiempo o devuelve su razonamiento
   * en vez de una respuesta, se reintenta UNA vez con este (solo en peticiones sin imagen). Por defecto
   * el que fue el principal antes de T-077: gratis y con ~100 % de disponibilidad en OpenRouter.
   */
  OPENROUTER_FALLBACK_MODEL: z.string().default("deepseek/deepseek-v4-flash-0731:free"),
  /**
   * Si un intento no ha producido texto visible en este tiempo se aborta (y se reintenta con el modelo de
   * respaldo). Debe quedar bien por debajo de `maxDuration` (60 s) de /api/chat: dos intentos caben.
   */
  OPENROUTER_FIRST_TOKEN_TIMEOUT_MS: positiveInt(20_000),
  /**
   * T-052: `stt_model`, transcripción de la voz de la alumna por `/audio/transcriptions` (acepta el
   * `webm` de MediaRecorder). No hay STT gratuito en OpenRouter; whisper-large-v3-turbo cuesta ~$0.012/hora de audio.
   */
  OPENROUTER_TRANSCRIBE_MODEL: z.string().default("openai/whisper-large-v3-turbo"),
  /** T-053: `tts_model`, síntesis por `/audio/speech` de OpenRouter (gratis, sin garantías de disponibilidad). */
  OPENROUTER_TTS_MODEL: z.string().default("fish-audio/s2.1-pro-free:free"),
  /** `tts_voice`: vacío = sin `voice` (solo vale si el proveedor tiene una por defecto; si no, fija una desde /admin). */
  OPENROUTER_TTS_VOICE: z.string().optional(),
  /** `tts_fallback_model`: se prueba si el TTS principal falla (de pago, ~$0.6–4 por millón de caracteres). Vacío = sin respaldo. */
  OPENROUTER_TTS_FALLBACK_MODEL: z.string().default("hexgrad/kokoro-82m"),
  /** `tts_fallback_voice`: voz en español de Kokoro (ef_dora). Sin verificar contra OpenRouter: ajustable en /admin. */
  OPENROUTER_TTS_FALLBACK_VOICE: z.string().default("ef_dora"),
  /**
   * T-053 (heredado): Fish Audio directo. Solo se usa si NO hay OPENROUTER_API_KEY; con ella, OpenRouter
   * sirve el TTS y esta clave sobra. Sin ninguna, /api/speech responde 204 y el cliente cae a speechSynthesis.
   */
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
  // CRÍTICO en producción: debe ser la URL pública de la app (https://eli.ngo en Vercel).
  // Si no se define, cae a localhost → Supabase redirige a http://localhost:3000/?code=...
  // en vez de a https://eli.ngo/?code=..., rompiendo el flujo de autenticación.
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
