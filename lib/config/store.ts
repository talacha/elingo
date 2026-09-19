import { getRepo } from "@/lib/db";
import { CONFIG_CACHE_PREFIX, invalidate, readThrough } from "./cache";

/**
 * Filas de `app_config` (Postgres) detrás de la caché de `lib/config/cache.ts`. Mezcla los
 * parámetros (`base_model`, ...) y el valor global de los flags (`flag.voice_mode`).
 */
export const CONFIG_ROWS_KEY = `${CONFIG_CACHE_PREFIX}:rows:v1`;

let lastKnownRows: Record<string, string> = {};

/**
 * Todas las filas. Si Postgres y la caché fallan (Neon caído, sin `app_config`), devuelve las
 * últimas filas conocidas — vacías al arrancar — para que la config nunca rompa el chat.
 */
export async function getConfigRows(): Promise<Record<string, string>> {
  try {
    const rows = await readThrough(CONFIG_ROWS_KEY, () => getRepo().getAiConfig());
    lastKnownRows = rows;
    return rows;
  } catch (error) {
    console.error("[config] no se pudo leer app_config, usando el último valor conocido", error);
    return lastKnownRows;
  }
}

export async function setConfigRow(key: string, value: string, updatedBy: string): Promise<void> {
  await getRepo().setAiConfig(key, value, updatedBy);
  await invalidate(CONFIG_ROWS_KEY);
}

export async function deleteConfigRow(key: string): Promise<void> {
  await getRepo().deleteAiConfig(key);
  await invalidate(CONFIG_ROWS_KEY);
}

/** Solo para tests. */
export function resetConfigStore(): void {
  lastKnownRows = {};
}
