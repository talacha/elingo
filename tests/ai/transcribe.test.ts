import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { transcribeAudio } from "@/lib/ai/transcribe";
import { resetEnvCache } from "@/lib/env";

const ENV_KEYS = ["OPENROUTER_API_KEY", "OPENROUTER_TRANSCRIBE_MODEL"];

const ok = (payload: unknown) => new Response(JSON.stringify(payload), { status: 200 });

describe("transcribeAudio (stt_model vía /audio/transcriptions)", () => {
  let error: ReturnType<typeof vi.spyOn>;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
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

  function withKey() {
    process.env.OPENROUTER_API_KEY = "test-key";
    resetEnvCache();
  }

  async function sentBody() {
    return JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
  }

  it("returns null if no OPENROUTER_API_KEY", async () => {
    expect(await transcribeAudio({ audio: "base64data", mimeType: "audio/webm" })).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts base64 audio to the dedicated endpoint with whisper-large-v3-turbo and returns the text", async () => {
    withKey();
    fetchSpy.mockResolvedValue(ok({ text: "  Hola mundo \n" }));

    expect(await transcribeAudio({ audio: "base64data", mimeType: "audio/webm" })).toBe("Hola mundo");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const call = fetchSpy.mock.calls[0];
    expect(call[0]).toBe("https://openrouter.ai/api/v1/audio/transcriptions");
    expect(call[1]?.method).toBe("POST");
    const headers = call[1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-key");
    expect(headers["Content-Type"]).toBe("application/json");

    expect(await sentBody()).toEqual({
      model: "openai/whisper-large-v3-turbo",
      input_audio: { data: "base64data", format: "webm" },
    });
  });

  it.each([
    ["audio/webm;codecs=opus", "webm"],
    ["audio/mp3", "mp3"],
    ["audio/ogg", "ogg"],
    ["audio/mp4", "mp4"],
    ["", "webm"],
  ])("derives the format from mimeType %j → %s (webm is what MediaRecorder gives Chrome)", async (mimeType, format) => {
    withKey();
    fetchSpy.mockResolvedValue(ok({ text: "test" }));
    await transcribeAudio({ audio: "data", mimeType });
    expect((await sentBody()).input_audio.format).toBe(format);
  });

  it("returns null on non-ok response status", async () => {
    withKey();
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }));

    expect(await transcribeAudio({ audio: "base64data", mimeType: "audio/webm" })).toBeNull();
    expect(error).toHaveBeenCalledWith(
      "[ai/transcribe] OpenRouter respondió mal",
      expect.objectContaining({ status: 401 }),
    );
  });

  it.each([
    ["no text field", { result: "something" }],
    ["empty text", { text: "   " }],
    ["non-string text", { text: 42 }],
  ])("returns null when the response has %s", async (_label, payload) => {
    withKey();
    fetchSpy.mockResolvedValue(ok(payload));
    expect(await transcribeAudio({ audio: "base64data", mimeType: "audio/webm" })).toBeNull();
  });

  it("returns null on network error", async () => {
    withKey();
    fetchSpy.mockRejectedValue(new Error("Network error"));

    expect(await transcribeAudio({ audio: "base64data", mimeType: "audio/webm" })).toBeNull();
    expect(error).toHaveBeenCalledWith("[ai/transcribe] fallo al llamar a OpenRouter", expect.any(Error));
  });

  it("uses a custom stt_model (OPENROUTER_TRANSCRIBE_MODEL) from env", async () => {
    process.env.OPENROUTER_TRANSCRIBE_MODEL = "qwen/qwen3-asr-0.6b";
    withKey();
    fetchSpy.mockResolvedValue(ok({ text: "test" }));

    await transcribeAudio({ audio: "data", mimeType: "audio/webm" });
    expect((await sentBody()).model).toBe("qwen/qwen3-asr-0.6b");
  });
});
