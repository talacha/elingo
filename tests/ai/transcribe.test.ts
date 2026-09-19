import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { transcribeAudio } from "@/lib/ai/transcribe";
import { resetEnvCache } from "@/lib/env";

const ENV_KEYS = ["OPENROUTER_API_KEY", "OPENROUTER_TRANSCRIBE_MODEL"];

const completion = (content: unknown) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });

describe("transcribeAudio (speech_model vía /chat/completions con input_audio)", () => {
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

  it("sends the audio as an input_audio part to the speech model and returns the trimmed text", async () => {
    withKey();
    fetchSpy.mockResolvedValue(completion("  Hola mundo \n"));

    const result = await transcribeAudio({ audio: "base64data", mimeType: "audio/mp3" });
    expect(result).toBe("Hola mundo");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const call = fetchSpy.mock.calls[0];
    expect(call[0]).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(call[1]?.method).toBe("POST");
    expect((call[1]?.headers as Record<string, string>).Authorization).toBe("Bearer test-key");

    const body = await sentBody();
    expect(body.model).toBe("nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free");
    const parts = body.messages[0].content;
    expect(parts[0].type).toBe("text");
    expect(parts[1]).toEqual({ type: "input_audio", input_audio: { data: "base64data", format: "mp3" } });
  });

  it.each([
    ["audio/webm;codecs=opus", "webm"],
    ["audio/mpeg", "mp3"],
    ["audio/mp4", "m4a"],
    ["audio/x-wav", "wav"],
    ["audio/ogg", "ogg"],
  ])("maps mimeType %s to format %s", async (mimeType, format) => {
    withKey();
    fetchSpy.mockResolvedValue(completion("ok"));
    await transcribeAudio({ audio: "data", mimeType });
    expect((await sentBody()).messages[0].content[1].input_audio.format).toBe(format);
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
    ["no choices", { result: "something" }],
    ["empty content", { choices: [{ message: { content: "   " } }] }],
    ["non-string content", { choices: [{ message: { content: [{ type: "text" }] } }] }],
  ])("returns null when the response has %s", async (_label, payload) => {
    withKey();
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
    expect(await transcribeAudio({ audio: "base64data", mimeType: "audio/webm" })).toBeNull();
  });

  it("returns null on network error", async () => {
    withKey();
    fetchSpy.mockRejectedValue(new Error("Network error"));

    expect(await transcribeAudio({ audio: "base64data", mimeType: "audio/webm" })).toBeNull();
    expect(error).toHaveBeenCalledWith("[ai/transcribe] fallo al llamar a OpenRouter", expect.any(Error));
  });

  it("uses a custom OPENROUTER_TRANSCRIBE_MODEL from env", async () => {
    process.env.OPENROUTER_TRANSCRIBE_MODEL = "vendor/audio-model";
    withKey();
    fetchSpy.mockResolvedValue(completion("test"));

    await transcribeAudio({ audio: "data", mimeType: "audio/webm" });
    expect((await sentBody()).model).toBe("vendor/audio-model");
  });
});
