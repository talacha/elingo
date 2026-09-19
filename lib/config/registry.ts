import { FLAG_KEYS, PROVIDER_NAMES, type FlagKey } from "@/lib/contracts/admin";
import type { Env } from "@/lib/env";

/**
 * Registro de configuración de ELI: la única lista de parámetros ajustables y de feature flags.
 * Fuente de verdad: tasks.md, sección 6.13.
 *
 * Qué NO está aquí, a propósito: secretos y conexiones (API keys, DATABASE_URL, Redis, QStash,
 * Supabase, ADMIN_EMAILS). Se quedan en variables de entorno: hacen falta para llegar a la base de
 * datos y no deben guardarse en ella.
 *
 * Precedencia de un parámetro: fila de `app_config` (Postgres, con caché en Redis) > variable de
 * entorno > valor por defecto de `lib/env.ts`.
 */

export const CONFIG_CATEGORIES = ["ia", "modelos", "voz", "limites"] as const;
export type ConfigCategory = (typeof CONFIG_CATEGORIES)[number];

/** Qué debe poder procesar un modelo para servir a este parámetro (se comprueba contra OpenRouter). */
export type ModelCapability = "text" | "image" | "audio";

export type ConfigKind = "provider" | "model" | "int" | "string";

export interface ConfigParamDef {
  key: string;
  /** Campo de `Env` que este parámetro sobrescribe (y de donde sale su valor si no hay fila). */
  envKey: keyof Env;
  label: string;
  description: string;
  category: ConfigCategory;
  kind: ConfigKind;
  /** Solo `provider`: valores permitidos. */
  options?: readonly string[];
  /** Solo `model`: qué entrada debe aceptar. */
  capability?: ModelCapability;
  /** Solo `int`. */
  min?: number;
  max?: number;
  /** false = solo lectura en /admin: el valor se fija al arrancar (rate limit, presupuesto). */
  editable: boolean;
}

export const CONFIG_PARAMS = [
  {
    key: "ai_provider",
    envKey: "AI_PROVIDER",
    label: "Proveedor de IA",
    description: "Quién responde a la alumna. Sin valor se deduce de las claves presentes.",
    category: "ia",
    kind: "provider",
    options: PROVIDER_NAMES,
    editable: true,
  },
  {
    key: "base_model",
    envKey: "OPENROUTER_MODEL",
    label: "Modelo base",
    description: "Modelo (OpenRouter) que responde las preguntas de texto.",
    category: "modelos",
    kind: "model",
    capability: "text",
    editable: true,
  },
  {
    key: "visual_model",
    envKey: "OPENROUTER_VISION_MODEL",
    label: "Modelo visual",
    description: "Modelo gratuito que interpreta las fotos (modo imagen). Debe aceptar imágenes.",
    category: "modelos",
    kind: "model",
    capability: "image",
    editable: true,
  },
  {
    key: "speech_model",
    envKey: "OPENROUTER_TRANSCRIBE_MODEL",
    label: "Modelo de voz",
    description: "Modelo gratuito que entiende la voz de la alumna (modo voz). Debe aceptar audio.",
    category: "modelos",
    kind: "model",
    capability: "audio",
    editable: true,
  },
  {
    key: "anthropic_model",
    envKey: "ANTHROPIC_MODEL",
    label: "Modelo de Anthropic",
    description: "Modelo que se usa cuando el proveedor activo es Anthropic.",
    category: "modelos",
    kind: "string",
    editable: true,
  },
  {
    key: "tts_model",
    envKey: "FISH_AUDIO_MODEL",
    label: "Modelo de síntesis de voz",
    description:
      "Modelo de Fish Audio que habla las respuestas de ELI. OpenRouter no ofrece síntesis gratuita; sin clave de Fish Audio se usa la voz del navegador.",
    category: "voz",
    kind: "string",
    editable: true,
  },
  {
    key: "ai_max_output_tokens",
    envKey: "AI_MAX_OUTPUT_TOKENS",
    label: "Tokens máximos de respuesta",
    description: "Tope de tokens que puede generar ELI en cada respuesta.",
    category: "limites",
    kind: "int",
    min: 64,
    max: 8192,
    editable: true,
  },
  {
    key: "ai_window_pairs",
    envKey: "AI_WINDOW_PAIRS",
    label: "Pares de historial",
    description: "Pares pregunta/respuesta previos que se envían al modelo (guardarraíl de coste).",
    category: "limites",
    kind: "int",
    min: 0,
    max: 20,
    editable: true,
  },
  {
    key: "ai_max_input_chars",
    envKey: "AI_MAX_INPUT_CHARS",
    label: "Caracteres máximos de pregunta",
    description: "Longitud máxima del mensaje de la alumna.",
    category: "limites",
    kind: "int",
    min: 50,
    max: 10_000,
    editable: true,
  },
  {
    key: "rate_limit_max",
    envKey: "RATE_LIMIT_MAX",
    label: "Peticiones por ventana",
    description: "Se fija al arrancar: cambiarlo requiere variable de entorno y redeploy.",
    category: "limites",
    kind: "int",
    editable: false,
  },
  {
    key: "rate_limit_window",
    envKey: "RATE_LIMIT_WINDOW",
    label: "Ventana del rate limit",
    description: "Se fija al arrancar: cambiarlo requiere variable de entorno y redeploy.",
    category: "limites",
    kind: "string",
    editable: false,
  },
  {
    key: "daily_token_budget",
    envKey: "DAILY_TOKEN_BUDGET",
    label: "Presupuesto diario de tokens",
    description: "Se fija al arrancar: cambiarlo requiere variable de entorno y redeploy.",
    category: "limites",
    kind: "int",
    editable: false,
  },
] as const satisfies readonly ConfigParamDef[];

export type ConfigKey = (typeof CONFIG_PARAMS)[number]["key"];

export function getParamDef(key: string): ConfigParamDef | undefined {
  return (CONFIG_PARAMS as readonly ConfigParamDef[]).find((p) => p.key === key);
}

export function editableParamKeys(): string[] {
  return CONFIG_PARAMS.filter((p) => p.editable).map((p) => p.key);
}

/**
 * Feature flags: se pueden apagar para todos (valor global) y, además, por cuenta. Un flag está
 * activo para una cuenta si lo está el global **y** la cuenta no lo ha apagado. Cada uno gobierna
 * una parte de la interfaz, que `GET /api/chat/capabilities` traduce a botones visibles.
 */
export { FLAG_KEYS, type FlagKey };

export interface FlagDef {
  key: FlagKey;
  label: string;
  description: string;
  /** Qué parte de la UI se muestra u oculta. */
  ui: string;
  defaultEnabled: boolean;
}

export const FLAGS: readonly FlagDef[] = [
  {
    key: "voice_mode",
    label: "Modo voz",
    description: "La alumna puede hablar con ELI y escuchar sus respuestas.",
    ui: "Botón de micrófono y botón «Escuchar»",
    defaultEnabled: true,
  },
  {
    key: "image_mode",
    label: "Modo imagen",
    description: "La alumna puede enviar una foto (deberes) para que ELI la interprete.",
    ui: "Botón de cámara / adjuntar imagen",
    defaultEnabled: true,
  },
];

export function isFlagKey(value: string): value is FlagKey {
  return (FLAG_KEYS as readonly string[]).includes(value);
}

/** Clave de la fila de `app_config` que guarda el valor global de un flag. */
export const globalFlagRowKey = (flag: FlagKey) => `flag.${flag}`;
