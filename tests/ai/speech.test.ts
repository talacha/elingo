import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { synthesizeSpeech } from "@/lib/ai/speech";
import { resetEnvCache } from "@/lib/env";

const ENV_KEYS = [
  "FISH_AUDIO_API_KEY",
  "FISH_AUDIO_MODEL",
];

describe("synthesizeSpeech", () => {
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

  it("returns null if no FISH_AUDIO_API_KEY", async () => {
    const result = await synthesizeSpeech("Hola mundo");
    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns SpeechResult with audio stream on successful response", async () => {
    process.env.FISH_AUDIO_API_KEY = "test-key";
    resetEnvCache();

    const mockAudioStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([0x1, 0x2, 0x3]));
        controller.close();
      },
    });

    fetchSpy.mockResolvedValue(
      new Response(mockAudioStream, {
        status: 200,
        headers: { "Content-Type": "audio/mpeg" },
      })
    );

    const result = await synthesizeSpeech("Hola mundo");
    expect(result).not.toBeNull();
    expect(result?.contentType).toBe("audio/mpeg");
    expect(result?.audio).toBeInstanceOf(ReadableStream);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const call = fetchSpy.mock.calls[0];
    expect(call[0]).toBe("https://api.fish.audio/v1/tts");
    expect(call[1]?.method).toBe("POST");

    const headers = call[1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-key");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers.model).toBe("s2.1-pro-free");

    const body = JSON.parse(call[1]?.body as string);
    expect(body.text).toBe("Hola mundo");
    expect(body.format).toBe("mp3");
  });

  it("uses custom FISH_AUDIO_MODEL from env", async () => {
    process.env.FISH_AUDIO_API_KEY = "test-key";
    process.env.FISH_AUDIO_MODEL = "custom-model-v1";
    resetEnvCache();

    const mockAudioStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close();
      },
    });

    fetchSpy.mockResolvedValue(
      new Response(mockAudioStream, { status: 200 })
    );

    await synthesizeSpeech("test");

    const call = fetchSpy.mock.calls[0];
    const headers = call[1]?.headers as Record<string, string>;
    expect(headers.model).toBe("custom-model-v1");
  });

  it("returns null on non-ok response status", async () => {
    process.env.FISH_AUDIO_API_KEY = "test-key";
    resetEnvCache();

    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    );

    const result = await synthesizeSpeech("test");
    expect(result).toBeNull();
    expect(error).toHaveBeenCalledWith(
      "[ai/speech] Fish Audio respondió mal",
      expect.objectContaining({ status: 401 })
    );
  });

  it("returns null if response.body is null", async () => {
    process.env.FISH_AUDIO_API_KEY = "test-key";
    resetEnvCache();

    fetchSpy.mockResolvedValue(
      new Response(null, { status: 200 })
    );

    const result = await synthesizeSpeech("test");
    expect(result).toBeNull();
    expect(error).toHaveBeenCalledWith(
      "[ai/speech] Fish Audio respondió mal",
      expect.any(Object)
    );
  });

  it("uses default content type if not provided in response", async () => {
    process.env.FISH_AUDIO_API_KEY = "test-key";
    resetEnvCache();

    const mockAudioStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close();
      },
    });

    fetchSpy.mockResolvedValue(
      new Response(mockAudioStream, { status: 200 })
    );

    const result = await synthesizeSpeech("test");
    expect(result?.contentType).toBe("audio/mpeg");
  });

  it("returns null on network error", async () => {
    process.env.FISH_AUDIO_API_KEY = "test-key";
    resetEnvCache();

    fetchSpy.mockRejectedValue(new Error("Network error"));

    const result = await synthesizeSpeech("test");
    expect(result).toBeNull();
    expect(error).toHaveBeenCalledWith(
      "[ai/speech] fallo al llamar a Fish Audio",
      expect.any(Error)
    );
  });

  it("handles content type with charset", async () => {
    process.env.FISH_AUDIO_API_KEY = "test-key";
    resetEnvCache();

    const mockAudioStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close();
      },
    });

    fetchSpy.mockResolvedValue(
      new Response(mockAudioStream, {
        status: 200,
        headers: { "Content-Type": "audio/mpeg; charset=utf-8" },
      })
    );

    const result = await synthesizeSpeech("test");
    expect(result?.contentType).toBe("audio/mpeg; charset=utf-8");
  });
});
