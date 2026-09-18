import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { transcribeAudio } from "@/lib/ai/transcribe";
import { resetEnvCache } from "@/lib/env";

const ENV_KEYS = [
  "OPENROUTER_API_KEY",
  "OPENROUTER_TRANSCRIBE_MODEL",
];

describe("transcribeAudio", () => {
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

  it("returns null if no OPENROUTER_API_KEY", async () => {
    const result = await transcribeAudio({ audio: "base64data", mimeType: "audio/webm" });
    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns the transcribed text on successful response", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    resetEnvCache();

    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ text: "Hola mundo" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const result = await transcribeAudio({ audio: "base64data", mimeType: "audio/webm" });
    expect(result).toBe("Hola mundo");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const call = fetchSpy.mock.calls[0];
    expect(call[0]).toBe("https://openrouter.ai/api/v1/audio/transcriptions");
    expect(call[1]?.method).toBe("POST");

    const headers = call[1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-key");
    expect(headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(call[1]?.body as string);
    expect(body.model).toBe("openai/whisper-large-v3-turbo");
    expect(body.input_audio.data).toBe("base64data");
    expect(body.input_audio.format).toBe("webm");
  });

  it("extracts format from mimeType correctly", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    resetEnvCache();

    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ text: "test" }), { status: 200 })
    );

    await transcribeAudio({ audio: "data", mimeType: "audio/mp3" });

    const call = fetchSpy.mock.calls[0];
    const body = JSON.parse(call[1]?.body as string);
    expect(body.input_audio.format).toBe("mp3");
  });

  it("handles mimeType with parameters (e.g., audio/webm;codecs=opus)", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    resetEnvCache();

    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ text: "test" }), { status: 200 })
    );

    await transcribeAudio({ audio: "data", mimeType: "audio/webm;codecs=opus" });

    const call = fetchSpy.mock.calls[0];
    const body = JSON.parse(call[1]?.body as string);
    expect(body.input_audio.format).toBe("webm");
  });

  it("returns null on non-ok response status", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    resetEnvCache();

    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    );

    const result = await transcribeAudio({ audio: "base64data", mimeType: "audio/webm" });
    expect(result).toBeNull();
    expect(error).toHaveBeenCalledWith(
      "[ai/transcribe] OpenRouter respondió mal",
      expect.objectContaining({ status: 401 })
    );
  });

  it("returns null if response body has no text field", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    resetEnvCache();

    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ result: "something" }), { status: 200 })
    );

    const result = await transcribeAudio({ audio: "base64data", mimeType: "audio/webm" });
    expect(result).toBeNull();
  });

  it("returns null on network error", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    resetEnvCache();

    fetchSpy.mockRejectedValue(new Error("Network error"));

    const result = await transcribeAudio({ audio: "base64data", mimeType: "audio/webm" });
    expect(result).toBeNull();
    expect(error).toHaveBeenCalledWith(
      "[ai/transcribe] fallo al llamar a OpenRouter",
      expect.any(Error)
    );
  });

  it("uses custom OPENROUTER_TRANSCRIBE_MODEL from env", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    process.env.OPENROUTER_TRANSCRIBE_MODEL = "openai/whisper-custom";
    resetEnvCache();

    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ text: "test" }), { status: 200 })
    );

    await transcribeAudio({ audio: "data", mimeType: "audio/webm" });

    const call = fetchSpy.mock.calls[0];
    const body = JSON.parse(call[1]?.body as string);
    expect(body.model).toBe("openai/whisper-custom");
  });
});
