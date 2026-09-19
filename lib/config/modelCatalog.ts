import { CONFIG_CACHE_PREFIX, readThrough } from "./cache";
import type { ModelCapability } from "./registry";

/**
 * Catálogo público de OpenRouter (id → modalidades de entrada), para no dejar guardar en /admin un
 * modelo que no puede hacer el trabajo: p. ej. un modelo solo de texto como modelo visual.
 * Cacheado 1 h; si el catálogo no responde no se valida nada (nunca bloquea un cambio por eso).
 */
const CATALOG_URL = "https://openrouter.ai/api/v1/models";
const CATALOG_KEY = `${CONFIG_CACHE_PREFIX}:models:v1`;
const HOUR_SECONDS = 3600;

type Catalog = Record<string, string[]>;

async function fetchCatalog(): Promise<Catalog> {
  const response = await fetch(CATALOG_URL, { signal: AbortSignal.timeout(4_000) });
  if (!response.ok) throw new Error(`OpenRouter /models respondió ${response.status}`);
  const body = (await response.json()) as {
    data?: { id: string; architecture?: { input_modalities?: string[] } }[];
  };
  return Object.fromEntries(
    (body.data ?? []).map((m) => [m.id, m.architecture?.input_modalities ?? ["text"]]),
  );
}

async function getCatalog(): Promise<Catalog | null> {
  try {
    return await readThrough(CATALOG_KEY, fetchCatalog, {
      localTtlMs: HOUR_SECONDS * 1000,
      redisTtlSeconds: HOUR_SECONDS,
    });
  } catch (error) {
    console.warn("[config] catálogo de OpenRouter no disponible, no se valida el modelo", error);
    return null;
  }
}

/** Mensaje de error si `model` no existe o no acepta `capability`; `null` si vale (o no se puede saber). */
export async function checkModelCapability(
  model: string,
  capability: ModelCapability,
): Promise<string | null> {
  const catalog = await getCatalog();
  if (!catalog) return null;
  const inputs = catalog[model];
  if (!inputs) return `«${model}» no está en el catálogo de OpenRouter.`;
  if (!inputs.includes(capability)) {
    const what = capability === "image" ? "imágenes" : capability === "audio" ? "audio" : "texto";
    return `«${model}» no acepta ${what} como entrada (solo: ${inputs.join(", ")}).`;
  }
  return null;
}
