import { getEnv, type Env } from "@/lib/env";

/** Sube al formato que OpenRouter espera en `input_audio.format` (wav, mp3, m4a, ogg, ...). */
const FORMAT_ALIASES: Record<string, string> = {
  mpeg: "mp3",
  mp4: "m4a",
  "x-m4a": "m4a",
  "x-wav": "wav",
  wave: "wav",
};

const TRANSCRIBE_PROMPT =
  "Transcribe literalmente lo que dice la persona en este audio, en el idioma en que habla. " +
  "Responde solo con la transcripción, sin comillas ni comentarios.";

/**
 * Entiende la voz de la alumna con el modelo de voz (`speech_model`, gratis en OpenRouter): un modelo
 * con entrada de audio, llamado por `/chat/completions` con una parte `input_audio`. Nunca lanza:
 * `null` si no hay OPENROUTER_API_KEY, si la llamada falla o si no hay texto — la ruta lo trata como
 * "no disponible" y el cliente cae a `SpeechRecognition` del navegador.
 *
 * Salvedad: OpenRouter documenta wav/mp3 (y algunos más según el modelo); `MediaRecorder` de Chrome
 * entrega `audio/webm`, que el modelo puede rechazar. En ese caso se degrada igual que un fallo.
 */
export async function transcribeAudio(
  input: { audio: string; mimeType: string },
  env: Env = getEnv(),
): Promise<string | null> {
  if (!env.OPENROUTER_API_KEY) return null;
  try {
    const subtype = input.mimeType.split("/")[1]?.split(";")[0]?.trim() || "webm";
    const format = FORMAT_ALIASES[subtype] ?? subtype;
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": env.NEXT_PUBLIC_APP_URL,
        "X-Title": "ELI",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.OPENROUTER_TRANSCRIBE_MODEL,
        max_tokens: 400,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: TRANSCRIBE_PROMPT },
              { type: "input_audio", input_audio: { data: input.audio, format } },
            ],
          },
        ],
      }),
    });
    if (!response.ok) {
      console.error("[ai/transcribe] OpenRouter respondió mal", { status: response.status });
      return null;
    }
    const body = (await response.json()) as { choices?: { message?: { content?: unknown } }[] };
    const text = body.choices?.[0]?.message?.content;
    return typeof text === "string" && text.trim().length > 0 ? text.trim() : null;
  } catch (error) {
    console.error("[ai/transcribe] fallo al llamar a OpenRouter", error);
    return null;
  }
}
