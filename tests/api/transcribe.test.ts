import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { POST } from "@/app/api/transcribe/route";
import { resetRateLimiter } from "@/lib/ratelimit";
import { resetEnvCache } from "@/lib/env";
import { ANON_COOKIE } from "@/lib/contracts/chat";
import type { TranscribeRequest } from "@/lib/contracts/media";
import { getRepo, resetRepo } from "@/lib/db";
import { NextRequest } from "next/server";

/** Mock transcribeAudio to isolate route logic */
vi.mock("@/lib/ai/transcribe", () => ({
  transcribeAudio: vi.fn(),
}));

/** Mock Supabase server client */
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

/** Create a valid test request. */
function createTranscribeRequest(overrides?: Partial<TranscribeRequest>): TranscribeRequest {
  return {
    audio: "base64encodedaudio",
    mimeType: "audio/webm",
    ...overrides,
  };
}

/** Helper to create a NextRequest. */
function createNextRequest(
  body: TranscribeRequest,
  headers?: Record<string, string>
): NextRequest {
  return new NextRequest("http://localhost:3000/api/transcribe", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      ...headers,
    },
  });
}

describe("POST /api/transcribe", () => {
  let transcribeAudioMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    resetEnvCache();
    resetRateLimiter();
    resetRepo();
    delete process.env.RATE_LIMIT_MAX;
    vi.clearAllMocks();

    const transcribeModule = await import("@/lib/ai/transcribe");
    transcribeAudioMock = vi.mocked(transcribeModule.transcribeAudio);
  });

  afterEach(() => {
    resetEnvCache();
    resetRateLimiter();
    resetRepo();
    delete process.env.RATE_LIMIT_MAX;
  });

  describe("input validation", () => {
    it("returns 400 invalid_request on invalid body", async () => {
      const req = createNextRequest({ audio: "", mimeType: "audio/webm" });
      const response = await POST(req);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe("invalid_request");
      expect(body.message).toBe("Cuerpo inválido");
    });

    it("returns 400 invalid_request if audio is missing", async () => {
      const req = new NextRequest("http://localhost:3000/api/transcribe", {
        method: "POST",
        body: JSON.stringify({ mimeType: "audio/webm" }),
        headers: { "content-type": "application/json" },
      });
      const response = await POST(req);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe("invalid_request");
    });

    it("returns 400 invalid_request if mimeType is missing", async () => {
      const req = new NextRequest("http://localhost:3000/api/transcribe", {
        method: "POST",
        body: JSON.stringify({ audio: "base64data" }),
        headers: { "content-type": "application/json" },
      });
      const response = await POST(req);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe("invalid_request");
    });
  });

  describe("rate limiting", () => {
    it("returns 429 rate_limited when limit exceeded", async () => {
      process.env.RATE_LIMIT_MAX = "1";
      resetRateLimiter();
      resetEnvCache();

      const anonId = crypto.randomUUID();

      // First request should succeed
      const req1 = createNextRequest(createTranscribeRequest(), {
        cookie: `${ANON_COOKIE}=${anonId}`,
      });
      transcribeAudioMock.mockResolvedValue("test text");
      const res1 = await POST(req1);
      expect(res1.status).toBe(200);

      // Second request with same anonId should be rate limited
      const req2 = createNextRequest(createTranscribeRequest(), {
        cookie: `${ANON_COOKIE}=${anonId}`,
      });
      const res2 = await POST(req2);

      expect(res2.status).toBe(429);
      const body = await res2.json();
      expect(body.error).toBe("rate_limited");
      expect(body.retryAfter).toBeDefined();
    });

    it("includes Retry-After header on rate limit", async () => {
      process.env.RATE_LIMIT_MAX = "1";
      resetRateLimiter();
      resetEnvCache();

      const anonId = crypto.randomUUID();

      const req1 = createNextRequest(createTranscribeRequest(), {
        cookie: `${ANON_COOKIE}=${anonId}`,
      });
      transcribeAudioMock.mockResolvedValue("test");
      await POST(req1);

      const req2 = createNextRequest(createTranscribeRequest(), {
        cookie: `${ANON_COOKIE}=${anonId}`,
      });
      const res2 = await POST(req2);

      expect(res2.headers.get("Retry-After")).toBeDefined();
    });

    it("uses IP as rate limit key when no cookie", async () => {
      process.env.RATE_LIMIT_MAX = "1";
      resetRateLimiter();
      resetEnvCache();

      // First request should succeed
      const req1 = createNextRequest(createTranscribeRequest());
      transcribeAudioMock.mockResolvedValue("test");
      const res1 = await POST(req1);
      expect(res1.status).toBe(200);

      // Second request from same IP should be rate limited
      const req2 = createNextRequest(createTranscribeRequest());
      const res2 = await POST(req2);
      expect(res2.status).toBe(429);
    });
  });

  describe("transcription success", () => {
    it("returns 200 with transcribed text on success", async () => {
      transcribeAudioMock.mockResolvedValue("Hola, esto es un texto transcrito");
      const req = createNextRequest(createTranscribeRequest());
      const response = await POST(req);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.text).toBe("Hola, esto es un texto transcrito");
    });

    it("calls transcribeAudio with correct input", async () => {
      transcribeAudioMock.mockResolvedValue("test");
      const req = createNextRequest(
        createTranscribeRequest({
          audio: "customaudio123",
          mimeType: "audio/mp3",
        })
      );
      await POST(req);

      expect(transcribeAudioMock).toHaveBeenCalledWith(
        expect.objectContaining({
          audio: "customaudio123",
          mimeType: "audio/mp3",
        }),
        // Config efectiva (env + lo guardado desde /admin): de ahí sale el `speech_model`.
        expect.objectContaining({ OPENROUTER_TRANSCRIBE_MODEL: expect.any(String) }),
      );
    });
  });

  describe("transcription unavailable", () => {
    it("returns 204 No Content when provider returns null", async () => {
      transcribeAudioMock.mockResolvedValue(null);
      const req = createNextRequest(createTranscribeRequest());
      const response = await POST(req);

      expect(response.status).toBe(204);
      expect(await response.text()).toBe("");
    });
  });

  describe("error handling", () => {
    it("returns 500 upstream_error on unexpected throw", async () => {
      transcribeAudioMock.mockRejectedValue(new Error("Unexpected error"));
      const req = createNextRequest(createTranscribeRequest());
      const response = await POST(req);

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe("upstream_error");
    });

    it("returns 400 on invalid JSON body", async () => {
      const req = new NextRequest("http://localhost:3000/api/transcribe", {
        method: "POST",
        body: "not valid json",
        headers: { "content-type": "application/json" },
      });
      const response = await POST(req);

      expect(response.status).toBe(500);
    });
  });

  describe("rate limit key generation", () => {
    it("uses different keys for different anonymous IDs", async () => {
      process.env.RATE_LIMIT_MAX = "1";
      resetRateLimiter();
      resetEnvCache();

      transcribeAudioMock.mockResolvedValue("test");

      const anonId1 = crypto.randomUUID();
      const req1 = createNextRequest(createTranscribeRequest(), {
        cookie: `${ANON_COOKIE}=${anonId1}`,
      });
      const res1 = await POST(req1);
      expect(res1.status).toBe(200);

      // Different anonId should not be rate limited
      const anonId2 = crypto.randomUUID();
      const req2 = createNextRequest(createTranscribeRequest(), {
        cookie: `${ANON_COOKIE}=${anonId2}`,
      });
      const res2 = await POST(req2);
      expect(res2.status).toBe(200);
    });
  });

  describe("user security flags (M7 - voice)", () => {
    it("allows authenticated user with allowVoice=true to transcribe", async () => {
      const { createSupabaseServerClient } = await import("@/lib/supabase/server");
      const repo = getRepo();
      const user = await repo.upsertUserFromSupabase({
        supabaseUserId: "sb-user-1",
        displayName: "Test",
      });
      await repo.updateUserFlags(user.id, { allowVoice: true });

      vi.mocked(createSupabaseServerClient).mockResolvedValue({
        auth: {
          getUser: () =>
            Promise.resolve({
              data: {
                user: { id: "sb-user-1", email: "a@b.com", user_metadata: { display_name: "Test" } },
              },
            }),
        },
      } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

      transcribeAudioMock.mockResolvedValue("Hola, esto es transcrito");
      const req = createNextRequest(createTranscribeRequest());
      const response = await POST(req);
      expect(response.status).toBe(200);
    });

    it("returns 204 (unavailable) for authenticated user with allowVoice=false", async () => {
      const { createSupabaseServerClient } = await import("@/lib/supabase/server");
      const repo = getRepo();
      const user = await repo.upsertUserFromSupabase({
        supabaseUserId: "sb-user-2",
        displayName: "Test2",
      });
      await repo.updateUserFlags(user.id, { allowVoice: false });

      vi.mocked(createSupabaseServerClient).mockResolvedValue({
        auth: {
          getUser: () =>
            Promise.resolve({
              data: {
                user: { id: "sb-user-2", email: "b@b.com", user_metadata: { display_name: "Test2" } },
              },
            }),
        },
      } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

      const req = createNextRequest(createTranscribeRequest());
      const response = await POST(req);
      expect(response.status).toBe(204);
    });

    it("allows anonymous user to transcribe regardless of flags", async () => {
      const { createSupabaseServerClient } = await import("@/lib/supabase/server");
      vi.mocked(createSupabaseServerClient).mockResolvedValue(null);

      transcribeAudioMock.mockResolvedValue("Hola, anónimo");
      const req = createNextRequest(createTranscribeRequest());
      const response = await POST(req);
      expect(response.status).toBe(200);
    });

    it("gracefully handles getUserSecurity errors", async () => {
      const { createSupabaseServerClient } = await import("@/lib/supabase/server");
      const repo = getRepo();
      await repo.upsertUserFromSupabase({
        supabaseUserId: "sb-user-3",
        displayName: "Test3",
      });
      vi.spyOn(repo, "getUserSecurity").mockRejectedValueOnce(new Error("DB error"));

      vi.mocked(createSupabaseServerClient).mockResolvedValue({
        auth: {
          getUser: () =>
            Promise.resolve({
              data: {
                user: { id: "sb-user-3", email: "c@b.com", user_metadata: { display_name: "Test3" } },
              },
            }),
        },
      } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

      transcribeAudioMock.mockResolvedValue("test");
      const req = createNextRequest(createTranscribeRequest());
      const response = await POST(req);
      // Should proceed as if user were anonymous (permissive default)
      expect(response.status).toBe(200);
    });
  });
});
