import { getEnv, type Env } from "@/lib/env";

export interface SpeechResult {
  audio: ReadableStream<Uint8Array>;
  contentType: string;
}

interface Voice {
  model: string;
  voice: string | undefined;
}

/** Modelos a probar, en orden: el TTS principal y, si está configurado, el de respaldo (de pago). */
function candidates(env: Env): Voice[] {
  const list: Voice[] = [{ model: env.OPENROUTER_TTS_MODEL, voice: env.OPENROUTER_TTS_VOICE || undefined }];
  if (env.OPENROUTER_TTS_FALLBACK_MODEL && env.OPENROUTER_TTS_FALLBACK_MODEL !== env.OPENROUTER_TTS_MODEL) {
    list.push({
      model: env.OPENROUTER_TTS_FALLBACK_MODEL,
      voice: env.OPENROUTER_TTS_FALLBACK_VOICE || undefined,
    });
  }
  return list;
}

/**
 * TTS por OpenRouter (`POST /api/v1/audio/speech`, compatible con la API de OpenAI): devuelve el audio
 * en bruto. Se pide `mp3` porque el formato por defecto es `pcm`, que el navegador no reproduce solo.
 * Se cobra por carácter de entrada.
 */
async function synthesizeWithOpenRouter(
  text: string,
  { model, voice }: Voice,
  env: Env,
): Promise<SpeechResult | null> {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": env.NEXT_PUBLIC_APP_URL,
        "X-Title": "ELI",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, input: text, response_format: "mp3", ...(voice ? { voice } : {}) }),
    });
    const contentType = response.headers.get("content-type") ?? "audio/mpeg";
    // Un error del proveedor llega como JSON, no como audio.
    if (!response.ok || !response.body || contentType.includes("json")) {
      console.error("[ai/speech] OpenRouter respondió mal", { model, status: response.status });
      return null;
    }
    return { audio: response.body, contentType };
  } catch (error) {
    console.error("[ai/speech] fallo al llamar a OpenRouter", { model, error });
    return null;
  }
}

/** Fish Audio directo (T-053, heredado): solo si no hay clave de OpenRouter. */
async function synthesizeWithFishAudio(text: string, env: Env): Promise<SpeechResult | null> {
  try {
    const response = await fetch("https://api.fish.audio/v1/tts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.FISH_AUDIO_API_KEY}`,
        "Content-Type": "application/json",
        model: env.FISH_AUDIO_MODEL,
      },
      body: JSON.stringify({ text, format: "mp3" }),
    });
    if (!response.ok || !response.body) {
      console.error("[ai/speech] Fish Audio respondió mal", { status: response.status });
      return null;
    }
    return { audio: response.body, contentType: response.headers.get("content-type") ?? "audio/mpeg" };
  } catch (error) {
    console.error("[ai/speech] fallo al llamar a Fish Audio", error);
    return null;
  }
}

/**
 * Voz de ELI (T-053). Con OPENROUTER_API_KEY usa el `tts_model` de OpenRouter y, si falla, el
 * `tts_fallback_model`; sin ella, Fish Audio directo si hay FISH_AUDIO_API_KEY. `null` si nada
 * responde — nunca lanza y la ruta contesta 204, con lo que el cliente cae a `speechSynthesis`.
 * Solo se manda el texto ya generado por ELI, nunca nada de la alumna.
 */
export async function synthesizeSpeech(text: string, env: Env = getEnv()): Promise<SpeechResult | null> {
  if (env.OPENROUTER_API_KEY) {
    for (const candidate of candidates(env)) {
      const result = await synthesizeWithOpenRouter(text, candidate, env);
      if (result) return result;
    }
    return null;
  }
  if (env.FISH_AUDIO_API_KEY) return synthesizeWithFishAudio(text, env);
  return null;
}
