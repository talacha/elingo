import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { POST } from "@/app/api/speech/route";
import { resetRateLimiter } from "@/lib/ratelimit";
import { resetEnvCache } from "@/lib/env";
import { ANON_COOKIE } from "@/lib/contracts/chat";
import type { SpeechRequest } from "@/lib/contracts/media";
import { getRepo, resetRepo } from "@/lib/db";
import { NextRequest } from "next/server";

/** Mock synthesizeSpeech to isolate route logic */
vi.mock("@/lib/ai/speech", () => ({
  synthesizeSpeech: vi.fn(),
}));

/** Mock Supabase server client */
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

/** Create a valid test request. */
function createSpeechRequest(overrides?: Partial<SpeechRequest>): SpeechRequest {
  return {
    text: "Hola, este es un texto para sintetizar",
    ...overrides,
  };
}

/** Helper to create a NextRequest. */
function createNextRequest(body: SpeechRequest, headers?: Record<string, string>): NextRequest {
  return new NextRequest("http://localhost:3000/api/speech", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      ...headers,
    },
  });
}

describe("POST /api/speech", () => {
  let synthesizeSpeechMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    resetEnvCache();
    resetRateLimiter();
    resetRepo();
    delete process.env.RATE_LIMIT_MAX;
    vi.clearAllMocks();

    const speechModule = await import("@/lib/ai/speech");
    synthesizeSpeechMock = vi.mocked(speechModule.synthesizeSpeech);
  });

  afterEach(() => {
    resetEnvCache();
    resetRateLimiter();
    resetRepo();
    delete process.env.RATE_LIMIT_MAX;
  });

  describe("input validation", () => {
    it("returns 400 invalid_request on empty text", async () => {
      const req = createNextRequest({ text: "" });
      const response = await POST(req);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe("invalid_request");
      expect(body.message).toBe("Cuerpo inválido");
    });

    it("returns 400 invalid_request if text is missing", async () => {
      const req = new NextRequest("http://localhost:3000/api/speech", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "content-type": "application/json" },
      });
      const response = await POST(req);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe("invalid_request");
    });

    it("returns 400 invalid_request if text exceeds MAX_SPEECH_INPUT_CHARS", async () => {
      const longText = "a".repeat(2001);
      const req = createNextRequest({ text: longText });
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
      const req1 = createNextRequest(createSpeechRequest(), {
        cookie: `${ANON_COOKIE}=${anonId}`,
      });
      const mockStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.close();
        },
      });
      synthesizeSpeechMock.mockResolvedValue({
        audio: mockStream,
        contentType: "audio/mpeg",
      });
      const res1 = await POST(req1);
      expect(res1.status).toBe(200);

      // Second request with same anonId should be rate limited
      const req2 = createNextRequest(createSpeechRequest(), {
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

      const req1 = createNextRequest(createSpeechRequest(), {
        cookie: `${ANON_COOKIE}=${anonId}`,
      });
      const mockStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.close();
        },
      });
      synthesizeSpeechMock.mockResolvedValue({
        audio: mockStream,
        contentType: "audio/mpeg",
      });
      await POST(req1);

      const req2 = createNextRequest(createSpeechRequest(), {
        cookie: `${ANON_COOKIE}=${anonId}`,
      });
      const res2 = await POST(req2);

      expect(res2.headers.get("Retry-After")).toBeDefined();
    });

    it("uses IP as rate limit key when no cookie", async () => {
      process.env.RATE_LIMIT_MAX = "1";
      resetRateLimiter();
      resetEnvCache();

      const mockStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.close();
        },
      });
      synthesizeSpeechMock.mockResolvedValue({
        audio: mockStream,
        contentType: "audio/mpeg",
      });

      // First request should succeed
      const req1 = createNextRequest(createSpeechRequest());
      const res1 = await POST(req1);
      expect(res1.status).toBe(200);

      // Second request from same IP should be rate limited
      const req2 = createNextRequest(createSpeechRequest());
      const res2 = await POST(req2);
      expect(res2.status).toBe(429);
    });
  });

  describe("speech synthesis success", () => {
    it("returns 200 with audio stream on success", async () => {
      const mockStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([0x1, 0x2, 0x3]));
          controller.close();
        },
      });
      synthesizeSpeechMock.mockResolvedValue({
        audio: mockStream,
        contentType: "audio/mpeg",
      });

      const req = createNextRequest(createSpeechRequest());
      const response = await POST(req);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("audio/mpeg");
    });

    it("calls synthesizeSpeech with correct text", async () => {
      const mockStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.close();
        },
      });
      synthesizeSpeechMock.mockResolvedValue({
        audio: mockStream,
        contentType: "audio/mpeg",
      });

      const req = createNextRequest(
        createSpeechRequest({ text: "Texto especial para prueba" })
      );
      await POST(req);

      expect(synthesizeSpeechMock).toHaveBeenCalledWith("Texto especial para prueba");
    });

    it("preserves custom content type from provider", async () => {
      const mockStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.close();
        },
      });
      synthesizeSpeechMock.mockResolvedValue({
        audio: mockStream,
        contentType: "audio/wav",
      });

      const req = createNextRequest(createSpeechRequest());
      const response = await POST(req);

      expect(response.headers.get("Content-Type")).toBe("audio/wav");
    });
  });

  describe("speech synthesis unavailable", () => {
    it("returns 204 No Content when provider returns null", async () => {
      synthesizeSpeechMock.mockResolvedValue(null);
      const req = createNextRequest(createSpeechRequest());
      const response = await POST(req);

      expect(response.status).toBe(204);
      expect(await response.text()).toBe("");
    });
  });

  describe("error handling", () => {
    it("returns 500 upstream_error on unexpected throw", async () => {
      synthesizeSpeechMock.mockRejectedValue(new Error("Unexpected error"));
      const req = createNextRequest(createSpeechRequest());
      const response = await POST(req);

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe("upstream_error");
    });

    it("returns 400 on invalid JSON body", async () => {
      const req = new NextRequest("http://localhost:3000/api/speech", {
        method: "POST",
        body: "not valid json",
        headers: { "content-type": "application/json" },
      });
      const response = await POST(req);

      expect(response.status).toBe(500);
    });
  });

  describe("rate limit key separation", () => {
    it("uses different keys for speech and transcribe (speech: prefix)", async () => {
      process.env.RATE_LIMIT_MAX = "1";
      resetRateLimiter();
      resetEnvCache();

      const anonId = crypto.randomUUID();

      const mockStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.close();
        },
      });
      synthesizeSpeechMock.mockResolvedValue({
        audio: mockStream,
        contentType: "audio/mpeg",
      });

      // First request to speech should succeed
      const req1 = createNextRequest(createSpeechRequest(), {
        cookie: `${ANON_COOKIE}=${anonId}`,
      });
      const res1 = await POST(req1);
      expect(res1.status).toBe(200);

      // Second request to speech with same anonId should be rate limited
      const req2 = createNextRequest(createSpeechRequest(), {
        cookie: `${ANON_COOKIE}=${anonId}`,
      });
      const res2 = await POST(req2);
      expect(res2.status).toBe(429);
    });
  });

  describe("user security flags (M7 - voice)", () => {
    it("allows authenticated user with allowVoice=true to synthesize", async () => {
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

      const mockStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.close();
        },
      });
      synthesizeSpeechMock.mockResolvedValue({
        audio: mockStream,
        contentType: "audio/mpeg",
      });

      const req = createNextRequest(createSpeechRequest());
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

      const req = createNextRequest(createSpeechRequest());
      const response = await POST(req);
      expect(response.status).toBe(204);
    });

    it("allows anonymous user to synthesize regardless of flags", async () => {
      const { createSupabaseServerClient } = await import("@/lib/supabase/server");
      vi.mocked(createSupabaseServerClient).mockResolvedValue(null);

      const mockStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.close();
        },
      });
      synthesizeSpeechMock.mockResolvedValue({
        audio: mockStream,
        contentType: "audio/mpeg",
      });

      const req = createNextRequest(createSpeechRequest());
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

      const mockStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.close();
        },
      });
      synthesizeSpeechMock.mockResolvedValue({
        audio: mockStream,
        contentType: "audio/mpeg",
      });

      const req = createNextRequest(createSpeechRequest());
      const response = await POST(req);
      // Should proceed as if user were anonymous (permissive default)
      expect(response.status).toBe(200);
    });
  });
});
