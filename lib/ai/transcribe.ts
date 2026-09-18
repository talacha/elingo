import { getEnv, type Env } from "@/lib/env";

/**
 * OpenRouter Whisper (T-052): endpoint DEDICADO /audio/transcriptions (no es /chat/completions).
 * Nunca lanza: null si no hay OPENROUTER_API_KEY o si la llamada falla — la ruta lo trata como
 * "no disponible" (el cliente ya debería haber intentado SpeechRecognition del navegador antes).
 */
export async function transcribeAudio(
  input: { audio: string; mimeType: string },
  env: Env = getEnv(),
): Promise<string | null> {
  if (!env.OPENROUTER_API_KEY) return null;
  try {
    const format = input.mimeType.split("/")[1]?.split(";")[0] ?? "webm";
    const response = await fetch("https://openrouter.ai/api/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
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
    const body = (await response.json()) as { text?: string };
    return typeof body.text === "string" ? body.text : null;
  } catch (error) {
    console.error("[ai/transcribe] fallo al llamar a OpenRouter", error);
    return null;
  }
}
