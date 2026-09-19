import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { synthesizeSpeech } from "@/lib/ai/speech";
import { resetEnvCache } from "@/lib/env";

const ENV_KEYS = [
  "OPENROUTER_API_KEY",
  "OPENROUTER_TTS_MODEL",
  "OPENROUTER_TTS_VOICE",
  "OPENROUTER_TTS_FALLBACK_MODEL",
  "OPENROUTER_TTS_FALLBACK_VOICE",
  "FISH_AUDIO_API_KEY",
];

const audio = (contentType = "audio/mpeg") =>
  new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "Content-Type": contentType } });

describe("synthesizeSpeech con OpenRouter (tts_model → tts_fallback_model)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
    process.env.OPENROUTER_API_KEY = "or-key";
    resetEnvCache();
    error = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
    resetEnvCache();
    fetchSpy.mockRestore();
    error.mockRestore();
  });

  const bodyOf = (call: number) => JSON.parse(fetchSpy.mock.calls[call][1]?.body as string);

  it("calls /audio/speech with the free Fish model, mp3 output and no voice by default", async () => {
    fetchSpy.mockResolvedValue(audio());

    const result = await synthesizeSpeech("Hola mundo");
    expect(result?.contentType).toBe("audio/mpeg");
    expect(result?.audio).toBeInstanceOf(ReadableStream);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const call = fetchSpy.mock.calls[0];
    expect(call[0]).toBe("https://openrouter.ai/api/v1/audio/speech");
    expect((call[1]?.headers as Record<string, string>).Authorization).toBe("Bearer or-key");
    // response_format mp3: el por defecto de OpenRouter es pcm, que el navegador no reproduce solo.
    expect(bodyOf(0)).toEqual({ model: "fish-audio/s2.1-pro-free:free", input: "Hola mundo", response_format: "mp3" });
  });

  it("sends the configured voice", async () => {
    process.env.OPENROUTER_TTS_VOICE = "es-voice-1";
    resetEnvCache();
    fetchSpy.mockResolvedValue(audio());

    await synthesizeSpeech("Hola");
    expect(bodyOf(0).voice).toBe("es-voice-1");
  });

  it("falls back to the paid model (Kokoro, Spanish voice) when the primary fails", async () => {
    fetchSpy.mockResolvedValueOnce(new Response("{}", { status: 503 })).mockResolvedValueOnce(audio());

    const result = await synthesizeSpeech("Hola");
    expect(result).not.toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(bodyOf(0).model).toBe("fish-audio/s2.1-pro-free:free");
    expect(bodyOf(1)).toMatchObject({ model: "hexgrad/kokoro-82m", voice: "ef_dora", response_format: "mp3" });
  });

  it("treats a JSON body (a provider error) as a failure even with status 200", async () => {
    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "voice required" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }))
      .mockResolvedValueOnce(audio());

    expect(await synthesizeSpeech("Hola")).not.toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("returns null (route answers 204, client uses speechSynthesis) when every model fails", async () => {
    fetchSpy.mockResolvedValue(new Response("{}", { status: 500 }));
    expect(await synthesizeSpeech("Hola")).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("returns null on network errors without throwing", async () => {
    fetchSpy.mockRejectedValue(new Error("offline"));
    expect(await synthesizeSpeech("Hola")).toBeNull();
  });

  it("does not try a fallback when it is disabled or identical to the primary", async () => {
    process.env.OPENROUTER_TTS_FALLBACK_MODEL = "fish-audio/s2.1-pro-free:free";
    resetEnvCache();
    fetchSpy.mockResolvedValue(new Response("{}", { status: 500 }));

    expect(await synthesizeSpeech("Hola")).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("prefers OpenRouter over the legacy direct Fish Audio key when both are set", async () => {
    process.env.FISH_AUDIO_API_KEY = "fish-key";
    resetEnvCache();
    fetchSpy.mockResolvedValue(audio());

    await synthesizeSpeech("Hola");
    expect(fetchSpy.mock.calls[0][0]).toBe("https://openrouter.ai/api/v1/audio/speech");
  });

  it("uses no network at all without any key", async () => {
    delete process.env.OPENROUTER_API_KEY;
    resetEnvCache();
    expect(await synthesizeSpeech("Hola")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
