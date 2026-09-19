import { getEnv, type Env } from "@/lib/env";

/**
 * Voz de la alumna → texto con el `stt_model` (OpenRouter): endpoint DEDICADO
 * `POST /api/v1/audio/transcriptions` (no es `/chat/completions`), que acepta `webm` —el formato que
 * graba `MediaRecorder` de Chrome— además de wav/mp3/ogg/m4a/flac/aac. Se cobra por segundo de audio.
 *
 * Nunca lanza: `null` si no hay OPENROUTER_API_KEY, si la llamada falla o si no hay texto — la ruta
 * lo trata como "no disponible" (el cliente ya debería haber intentado `SpeechRecognition` antes).
 */
export async function transcribeAudio(
  input: { audio: string; mimeType: string },
  env: Env = getEnv(),
): Promise<string | null> {
  if (!env.OPENROUTER_API_KEY) return null;
  try {
    const format = input.mimeType.split("/")[1]?.split(";")[0]?.trim() || "webm";
    const response = await fetch("https://openrouter.ai/api/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": env.NEXT_PUBLIC_APP_URL,
        "X-Title": "ELI",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.OPENROUTER_TRANSCRIBE_MODEL,
        input_audio: { data: input.audio, format },
      }),
    });
    if (!response.ok) {
      console.error("[ai/transcribe] OpenRouter respondió mal", { status: response.status });
      return null;
    }
    const body = (await response.json()) as { text?: unknown };
    return typeof body.text === "string" && body.text.trim().length > 0 ? body.text.trim() : null;
  } catch (error) {
    console.error("[ai/transcribe] fallo al llamar a OpenRouter", error);
    return null;
  }
}
