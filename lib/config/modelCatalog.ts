import { CONFIG_CACHE_PREFIX, readThrough } from "./cache";
import type { ModelCapability } from "./registry";

/**
 * Catálogo público de OpenRouter, para no dejar guardar en /admin un modelo que no puede hacer el
 * trabajo (p. ej. un modelo solo de texto como modelo visual, o uno de chat como TTS).
 *
 * Hay tres listados y el de por defecto NO incluye los otros dos:
 *   - chat:          /models                                (entrada: text, image, audio, video…)
 *   - TTS:           /models?output_modalities=speech
 *   - STT:           /models?output_modalities=transcription
 * Cacheado 1 h; si el catálogo no responde no se valida nada (nunca bloquea un cambio por eso).
 */
const BASE_URL = "https://openrouter.ai/api/v1/models";
const HOUR_SECONDS = 3600;

type Catalog = Record<string, string[]>;
type CatalogKind = "chat" | "speech" | "transcription";

const CATALOG_URL: Record<CatalogKind, string> = {
  chat: BASE_URL,
  speech: `${BASE_URL}?output_modalities=speech`,
  transcription: `${BASE_URL}?output_modalities=transcription`,
};

/** Catálogo donde hay que buscar el modelo según lo que debe hacer. */
function catalogFor(capability: ModelCapability): CatalogKind {
  return capability === "speech" || capability === "transcription" ? capability : "chat";
}

async function fetchCatalog(kind: CatalogKind): Promise<Catalog> {
  const response = await fetch(CATALOG_URL[kind], { signal: AbortSignal.timeout(4_000) });
  if (!response.ok) throw new Error(`OpenRouter /models (${kind}) respondió ${response.status}`);
  const body = (await response.json()) as {
    data?: { id: string; architecture?: { input_modalities?: string[] } }[];
  };
  return Object.fromEntries(
    (body.data ?? []).map((m) => [m.id, m.architecture?.input_modalities ?? ["text"]]),
  );
}

async function getCatalog(kind: CatalogKind): Promise<Catalog | null> {
  try {
    return await readThrough(`${CONFIG_CACHE_PREFIX}:models:${kind}:v1`, () => fetchCatalog(kind), {
      localTtlMs: HOUR_SECONDS * 1000,
      redisTtlSeconds: HOUR_SECONDS,
    });
  } catch (error) {
    console.warn("[config] catálogo de OpenRouter no disponible, no se valida el modelo", error);
    return null;
  }
}

const KIND_LABEL: Record<CatalogKind, string> = {
  chat: "de chat",
  speech: "de texto a voz (TTS)",
  transcription: "de voz a texto (STT)",
};

/** Mensaje de error si `model` no existe o no sirve para `capability`; `null` si vale (o no se puede saber). */
export async function checkModelCapability(
  model: string,
  capability: ModelCapability,
): Promise<string | null> {
  const kind = catalogFor(capability);
  const catalog = await getCatalog(kind);
  if (!catalog) return null;

  const inputs = catalog[model];
  if (!inputs) return `«${model}» no es un modelo ${KIND_LABEL[kind]} del catálogo de OpenRouter.`;

  // STT/TTS: estar en su catálogo ya es la prueba. Chat: además debe aceptar la entrada que se necesita.
  if (kind === "chat" && !inputs.includes(capability)) {
    const what = capability === "image" ? "imágenes" : "texto";
    return `«${model}» no acepta ${what} como entrada (solo: ${inputs.join(", ")}).`;
  }
  return null;
}
