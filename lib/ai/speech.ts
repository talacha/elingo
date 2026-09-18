import { getEnv, type Env } from "@/lib/env";

export interface SpeechResult {
  audio: ReadableStream<Uint8Array>;
  contentType: string;
}

/**
 * Fish Audio TTS (T-053). null si no hay FISH_AUDIO_API_KEY o si falla — nunca lanza.
 * Solo se le manda el texto ya generado por ELI, nunca nada de la alumna.
 */
export async function synthesizeSpeech(text: string, env: Env = getEnv()): Promise<SpeechResult | null> {
  if (!env.FISH_AUDIO_API_KEY) return null;
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
