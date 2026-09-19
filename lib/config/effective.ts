import type { AdminConfigParam } from "@/lib/contracts/admin";
import { MOCK_MODEL } from "@/lib/ai/providers/mock";
import { getEnv, resolveProvider, type Env } from "@/lib/env";
import { CONFIG_PARAMS, type ConfigParamDef } from "./registry";
import { getConfigRows } from "./store";

/** Valor de una fila ya interpretado para el campo de `Env` (los enteros dejan de ser texto). */
function coerce(def: ConfigParamDef, raw: string): string | number | undefined {
  const value = raw.trim();
  if (!value) return undefined;
  if (def.kind === "int") {
    const n = Number(value);
    return Number.isInteger(n) && n >= (def.min ?? 0) ? n : undefined;
  }
  if (def.kind === "provider") return def.options?.includes(value) ? value : undefined;
  return value;
}

/**
 * `Env` con las filas de `app_config` por encima. Solo cuentan los parámetros editables del
 * registro, y un valor que no valida (p. ej. un proveedor desconocido guardado antes de existir la
 * validación) se ignora: nunca deja al chat sin proveedor. Sin ninguna fila aplicable devuelve el
 * mismo objeto `env`, para que las cachés por identidad (`getProvider`) sigan valiendo.
 */
export function applyConfigOverrides(env: Env, rows: Record<string, string>): Env {
  let effective: Env | null = null;
  for (const def of CONFIG_PARAMS as readonly ConfigParamDef[]) {
    const raw = rows[def.key];
    if (!def.editable || raw === undefined) continue;
    const value = coerce(def, raw);
    if (value === undefined) continue;
    effective ??= { ...env };
    (effective as Record<string, unknown>)[def.envKey] = value;
  }
  return effective ?? env;
}

/** Env efectivo ahora mismo: variables de entorno + config guardada en Postgres (vía Redis). */
export async function getEffectiveEnv(env: Env = getEnv()): Promise<Env> {
  return applyConfigOverrides(env, await getConfigRows());
}

export interface EffectiveConfig {
  provider: string;
  /** Modelo que atiende el chat ahora mismo con el proveedor activo. */
  activeModel: string;
  params: AdminConfigParam[];
}

/** Lo que /admin muestra: cada parámetro con su valor efectivo y si viene de una fila guardada. */
export function describeConfig(env: Env, rows: Record<string, string>): EffectiveConfig {
  const effective = applyConfigOverrides(env, rows);
  const provider = resolveProvider(effective);
  const activeModel =
    provider === "anthropic"
      ? effective.ANTHROPIC_MODEL
      : provider === "openrouter"
        ? effective.OPENROUTER_MODEL
        : MOCK_MODEL;

  const params = (CONFIG_PARAMS as readonly ConfigParamDef[]).map((def): AdminConfigParam => {
    const value = def.key === "ai_provider" ? provider : String(effective[def.envKey] ?? "");
    const stored = rows[def.key];
    const overridden = def.editable && stored !== undefined && coerce(def, stored) !== undefined;
    return {
      key: def.key,
      label: def.label,
      description: def.description,
      category: def.category,
      kind: def.kind,
      ...(def.options ? { options: [...def.options] } : {}),
      ...(def.capability ? { capability: def.capability } : {}),
      editable: def.editable,
      value,
      source: overridden ? "db" : "env",
    };
  });
  return { provider, activeModel, params };
}
