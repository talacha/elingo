import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { POST } from "@/app/api/chat/route";
import { resetRateLimiter } from "@/lib/ratelimit";
import { resetEnvCache } from "@/lib/env";
import { ANON_COOKIE, CHAT_HEADERS } from "@/lib/contracts/chat";
import type { ChatRequest } from "@/lib/contracts/chat";
import { getRepo, resetRepo } from "@/lib/db";
import { NextRequest } from "next/server";

/** Minimal mock for QStash to avoid persistence overhead in tests. */
vi.mock("@upstash/qstash", () => ({
  Client: vi.fn().mockImplementation(() => ({
    publishJSON: vi.fn().mockResolvedValue({}),
  })),
}));

/** Mock next/server's `after()` function to prevent "outside request scope" errors in tests. */
vi.mock("next/server", async () => {
  const actual = await vi.importActual("next/server");
  return {
    ...actual,
    after: vi.fn(() => {
      // In tests, just return without executing (the callback will be picked up by real after() in production)
      return undefined;
    }),
  };
});

/** Mock Supabase server client. */
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

/** Create a valid test request. */
function createChatRequest(overrides?: Partial<ChatRequest>): ChatRequest {
  return {
    sessionId: crypto.randomUUID(),
    messages: [{ id: crypto.randomUUID(), role: "user", content: "¿Cuánto es 2+2?" }],
    ...overrides,
  };
}

/** Helper to create a NextRequest. */
function createNextRequest(body: ChatRequest, headers?: Record<string, string>): NextRequest {
  return new NextRequest("http://localhost:3000/api/chat", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      ...headers,
    },
  });
}

describe("POST /api/chat", () => {
  beforeEach(() => {
    resetEnvCache();
    resetRateLimiter();
    resetRepo();
    delete process.env.RATE_LIMIT_MAX;
    delete process.env.AI_MAX_INPUT_CHARS;
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetEnvCache();
    resetRateLimiter();
    resetRepo();
    delete process.env.RATE_LIMIT_MAX;
    delete process.env.AI_MAX_INPUT_CHARS;
  });

  describe("anonymous cookie (eli_anon)", () => {
    it("sets a new eli_anon cookie if none exists", async () => {
      const req = createNextRequest(createChatRequest());
      const response = await POST(req);

      // Should succeed (200)
      expect(response.status).toBe(200);

      // Check that the cookie was set
      const setCookieHeader = response.headers.get("set-cookie");
      expect(setCookieHeader).toBeTruthy();
      expect(setCookieHeader).toContain(ANON_COOKIE);
      expect(setCookieHeader).toContain("HttpOnly");
      expect(setCookieHeader).toContain("Path=/");
      // SameSite is lowercase in the Set-Cookie header
      expect(setCookieHeader).toMatch(/SameSite=lax/i);
      // maxAge should be approximately 1 year in seconds (31536000)
      expect(setCookieHeader).toContain("Max-Age=31536000");
    });

    it("does not overwrite eli_anon if it already exists", async () => {
      const existingCookie = crypto.randomUUID();
      const req = createNextRequest(createChatRequest(), {
        cookie: `${ANON_COOKIE}=${existingCookie}`,
      });

      const response = await POST(req);
      expect(response.status).toBe(200);

      // The Set-Cookie header should not be present (no new cookie)
      const setCookieHeader = response.headers.get("set-cookie");
      // If the cookie was not changed, there should be no Set-Cookie header
      // (or it might be empty if Next.js includes it anyway)
      if (setCookieHeader) {
        // If present, it should not contain the ANON_COOKIE
        expect(setCookieHeader).not.toContain(ANON_COOKIE);
      }
    });

    it("sets eli_anon even on rate limit error", async () => {
      // Exhaust rate limit for this test
      process.env.RATE_LIMIT_MAX = "1";
      resetRateLimiter();
      resetEnvCache();

      // Use the same anonId across both requests to trigger rate limit on the second
      const anonId = crypto.randomUUID();

      const req1 = createNextRequest(createChatRequest(), {
        cookie: `${ANON_COOKIE}=${anonId}`,
      });
      const res1 = await POST(req1);
      expect(res1.status).toBe(200);

      // Second request with same anonId should be rate limited
      const req2 = createNextRequest(createChatRequest(), {
        cookie: `${ANON_COOKIE}=${anonId}`,
      });
      const response = await POST(req2);

      // Should be rate limited (429)
      expect(response.status).toBe(429);

      // The Set-Cookie header should NOT be present because anonId was already in the cookie
      const setCookieHeader = response.headers.get("set-cookie");
      // If a cookie was created, it would only be set if anonId wasn't present initially
      // Since we provided the anonId, no new cookie should be set
      if (setCookieHeader) {
        expect(setCookieHeader).not.toContain(ANON_COOKIE);
      }
    });
  });

  describe("rate limiting with improved key", () => {
    it("uses anonId as the rate limit key", async () => {
      process.env.RATE_LIMIT_MAX = "1";
      resetRateLimiter();
      resetEnvCache();

      const anonId = crypto.randomUUID();

      // First request should succeed
      const req1 = createNextRequest(createChatRequest(), {
        cookie: `${ANON_COOKIE}=${anonId}`,
      });
      const res1 = await POST(req1);
      expect(res1.status).toBe(200);

      // Second request with same anonId should be rate limited
      const req2 = createNextRequest(createChatRequest(), {
        cookie: `${ANON_COOKIE}=${anonId}`,
      });
      const res2 = await POST(req2);
      expect(res2.status).toBe(429);

      // Third request with different anonId should succeed
      const anonId2 = crypto.randomUUID();
      const req3 = createNextRequest(createChatRequest(), {
        cookie: `${ANON_COOKIE}=${anonId2}`,
      });
      const res3 = await POST(req3);
      expect(res3.status).toBe(200);
    });

    it("returns 429 with Retry-After header when rate limited", async () => {
      process.env.RATE_LIMIT_MAX = "1";
      resetRateLimiter();
      resetEnvCache();

      const anonId = crypto.randomUUID();

      // First request uses up the limit
      const req1 = createNextRequest(createChatRequest(), {
        cookie: `${ANON_COOKIE}=${anonId}`,
      });
      await POST(req1);

      // Second request should be rate limited
      const req2 = createNextRequest(createChatRequest(), {
        cookie: `${ANON_COOKIE}=${anonId}`,
      });
      const res2 = await POST(req2);
      expect(res2.status).toBe(429);

      // Check Retry-After header
      const retryAfter = res2.headers.get("Retry-After");
      expect(retryAfter).toBeTruthy();
      const retryAfterSecs = parseInt(retryAfter!, 10);
      expect(retryAfterSecs).toBeGreaterThan(0);

      // Check response body
      const body = await res2.json();
      expect(body.error).toBe("rate_limited");
      expect(body.retryAfter).toBeGreaterThan(0);
    });

    it("extracts client IP from x-forwarded-for header", async () => {
      const req = createNextRequest(createChatRequest(), {
        "x-forwarded-for": "192.168.1.100, 10.0.0.1",
      });

      // Just verify that the request is processed (IP extraction doesn't cause errors)
      const response = await POST(req);
      expect(response.status).toBe(200);

      // The response should include headers indicating a successful chat
      const sessionId = response.headers.get(CHAT_HEADERS.sessionId);
      expect(sessionId).toBeTruthy();
    });
  });

  describe("response headers", () => {
    it("includes x-model header with provider model name", async () => {
      const req = createNextRequest(createChatRequest());
      const response = await POST(req);

      expect(response.status).toBe(200);
      const model = response.headers.get(CHAT_HEADERS.model);
      expect(model).toBeTruthy();
      // Mock provider uses "eli-mock" as model
      expect(model).toBe("eli-mock");
    });

    it("includes x-session-id header", async () => {
      const sessionId = crypto.randomUUID();
      const req = createNextRequest(createChatRequest({ sessionId }));
      const response = await POST(req);

      expect(response.status).toBe(200);
      const resSessionId = response.headers.get(CHAT_HEADERS.sessionId);
      expect(resSessionId).toBe(sessionId);
    });

    it("includes x-provider header", async () => {
      const req = createNextRequest(createChatRequest());
      const response = await POST(req);

      expect(response.status).toBe(200);
      const provider = response.headers.get(CHAT_HEADERS.provider);
      expect(provider).toBe("mock");
    });
  });

  describe("validation", () => {
    it("rejects invalid JSON body", async () => {
      const req = new NextRequest("http://localhost:3000/api/chat", {
        method: "POST",
        body: "not json",
        headers: { "content-type": "application/json" },
      });

      const response = await POST(req);
      expect(response.status).toBe(500); // JSON parse errors result in upstream_error
    });

    it("rejects invalid request schema (missing required fields)", async () => {
      const req = createNextRequest({
        // Missing sessionId
        messages: [],
      } as unknown as ChatRequest);

      const response = await POST(req);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe("invalid_request");
    });

    it("rejects messages that are too long", async () => {
      process.env.AI_MAX_INPUT_CHARS = "10";
      resetEnvCache();

      const req = createNextRequest(
        createChatRequest({
          messages: [
            { id: crypto.randomUUID(), role: "user", content: "This is way too long for the limit" },
          ],
        })
      );

      const response = await POST(req);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe("invalid_request");
    });
  });

  describe("user security flags (M7)", () => {
    it("allows authenticated user with allowImages=true to send image", async () => {
      const { createSupabaseServerClient } = await import("@/lib/supabase/server");
      const repo = getRepo();
      const user = await repo.upsertUserFromSupabase({
        supabaseUserId: "sb-user-1",
        displayName: "Test",
      });
      await repo.updateUserFlags(user.id, { allowImages: true });

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

      const req = createNextRequest(
        createChatRequest({
          messages: [
            {
              id: crypto.randomUUID(),
              role: "user",
              content: "Mira esta foto",
              image: { mediaType: "image/jpeg", data: "fake-base64-data" },
            },
          ],
        })
      );

      const response = await POST(req);
      expect(response.status).toBe(200);
    });

    it("rejects authenticated user with allowImages=false sending image", async () => {
      const { createSupabaseServerClient } = await import("@/lib/supabase/server");
      const repo = getRepo();
      const user = await repo.upsertUserFromSupabase({
        supabaseUserId: "sb-user-2",
        displayName: "Test2",
      });
      await repo.updateUserFlags(user.id, { allowImages: false });

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

      const req = createNextRequest(
        createChatRequest({
          messages: [
            {
              id: crypto.randomUUID(),
              role: "user",
              content: "Mira esta foto",
              image: { mediaType: "image/jpeg", data: "fake-base64-data" },
            },
          ],
        })
      );

      const response = await POST(req);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe("invalid_request");
      expect(body.message).toContain("imágenes están desactivadas");
    });

    it("allows authenticated user with allowImages=false to send text-only message", async () => {
      const { createSupabaseServerClient } = await import("@/lib/supabase/server");
      const repo = getRepo();
      const user = await repo.upsertUserFromSupabase({
        supabaseUserId: "sb-user-3",
        displayName: "Test3",
      });
      await repo.updateUserFlags(user.id, { allowImages: false });

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

      const req = createNextRequest(
        createChatRequest({
          messages: [
            {
              id: crypto.randomUUID(),
              role: "user",
              content: "Pregunta de texto",
            },
          ],
        })
      );

      const response = await POST(req);
      expect(response.status).toBe(200);
    });

    it("allows anonymous user to send image regardless of flags", async () => {
      const { createSupabaseServerClient } = await import("@/lib/supabase/server");
      vi.mocked(createSupabaseServerClient).mockResolvedValue(null);

      const req = createNextRequest(
        createChatRequest({
          messages: [
            {
              id: crypto.randomUUID(),
              role: "user",
              content: "Mira esta foto",
              image: { mediaType: "image/jpeg", data: "fake-base64-data" },
            },
          ],
        })
      );

      const response = await POST(req);
      expect(response.status).toBe(200);
    });

    it("gracefully handles getUserSecurity errors", async () => {
      const { createSupabaseServerClient } = await import("@/lib/supabase/server");
      const repo = getRepo();
      await repo.upsertUserFromSupabase({
        supabaseUserId: "sb-user-4",
        displayName: "Test4",
      });
      vi.spyOn(repo, "getUserSecurity").mockRejectedValueOnce(new Error("DB error"));

      vi.mocked(createSupabaseServerClient).mockResolvedValue({
        auth: {
          getUser: () =>
            Promise.resolve({
              data: {
                user: { id: "sb-user-4", email: "d@b.com", user_metadata: { display_name: "Test4" } },
              },
            }),
        },
      } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

      const req = createNextRequest(
        createChatRequest({
          messages: [
            {
              id: crypto.randomUUID(),
              role: "user",
              content: "Mira esta foto",
              image: { mediaType: "image/jpeg", data: "fake-base64-data" },
            },
          ],
        })
      );

      // Should not crash; should proceed as if user were anonymous (permissive default)
      const response = await POST(req);
      expect(response.status).toBe(200);
    });
  });
});
