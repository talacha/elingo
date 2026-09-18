import { getRepo } from "@/lib/db";
import type { AppSetting } from "@/lib/db/repo";

/**
 * Ajustes configurables en tiempo de ejecución desde /admin, como capa opcional sobre el valor
 * por defecto de la variable de entorno (tasks.md 6.6 sigue siendo la fuente del valor de arranque).
 * Caché corta en memoria para no consultar la base en cada petición de chat.
 */
export const SETTINGS_KEYS = {
  openRouterModel: "OPENROUTER_MODEL",
} as const;

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { value: string | null; expiresAt: number }>();

export async function getSetting(key: string): Promise<string | null> {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  const value = await getRepo().getSetting(key);
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

export async function setSetting(key: string, value: string, updatedBy?: string): Promise<void> {
  await getRepo().setSetting(key, value, updatedBy);
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

export async function listSettings(): Promise<AppSetting[]> {
  return getRepo().listSettings();
}

/** Solo para tests. */
export function resetSettingsCache(): void {
  cache.clear();
}
