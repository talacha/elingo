import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { POST } from "@/app/api/parents/unlock/route";
import { resetEnvCache } from "@/lib/env";
import { getRepo, resetRepo } from "@/lib/db";
import { hashSafeWord } from "@/lib/auth/safeWord";
import { resetParentUnlockMemory } from "@/lib/auth/parentUnlock";
import { PARENT_UNLOCK_COOKIE } from "@/lib/contracts/parents";
import type { UnlockRequest } from "@/lib/contracts/parents";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

function createUnlockRequest(overrides?: Partial<UnlockRequest>): UnlockRequest {
  return {
    safeWord: "mySecureWord123",
    ...overrides,
  };
}

function createNextRequest(
  body: UnlockRequest,
  headers?: Record<string, string>
): NextRequest {
  return new NextRequest("http://localhost:3000/api/parents/unlock", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      ...headers,
    },
  });
}

describe("POST /api/parents/unlock", () => {
  beforeEach(() => {
    resetEnvCache();
    resetRepo();
    resetParentUnlockMemory();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetEnvCache();
    resetRepo();
    resetParentUnlockMemory();
  });

  it("returns 401 if not logged in", async () => {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    vi.mocked(createSupabaseServerClient).mockResolvedValue(null);

    const req = createNextRequest(createUnlockRequest());
    const response = await POST(req);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("unauthorized");
  });

  it("returns 401 if Supabase returns no user", async () => {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: null } }),
      },
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    const req = createNextRequest(createUnlockRequest());
    const response = await POST(req);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("unauthorized");
  });

  it("returns 409 needs_safe_word if no safe word is set yet", async () => {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
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

    const req = createNextRequest(createUnlockRequest());
    const response = await POST(req);

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toBe("needs_safe_word");
    expect(body.message).toContain("palabra segura");
  });

  it("returns 400 if safe word is missing from request", async () => {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
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

    const repo = getRepo();
    const user = await repo.upsertUserFromSupabase({
      supabaseUserId: "sb-user-1",
      displayName: "Test",
    });
    const hash = await hashSafeWord("testPassword123");
    await repo.setSafeWordHash(user.id, hash);

    const req = createNextRequest({ safeWord: "" });
    const response = await POST(req);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("invalid_request");
  });

  it("returns 401 if safe word is incorrect", async () => {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
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

    const repo = getRepo();
    const user = await repo.upsertUserFromSupabase({
      supabaseUserId: "sb-user-1",
      displayName: "Test",
    });
    const hash = await hashSafeWord("correctPassword123");
    await repo.setSafeWordHash(user.id, hash);

    const req = createNextRequest(createUnlockRequest({ safeWord: "wrongPassword123" }));
    const response = await POST(req);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("unauthorized");
    expect(body.message).toContain("incorrecta");
  });

  it("unlocks successfully with correct safe word and sets httpOnly cookie", async () => {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
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

    const repo = getRepo();
    const user = await repo.upsertUserFromSupabase({
      supabaseUserId: "sb-user-1",
      displayName: "Test",
    });
    const correctWord = "correctPassword123";
    const hash = await hashSafeWord(correctWord);
    await repo.setSafeWordHash(user.id, hash);

    const req = createNextRequest(createUnlockRequest({ safeWord: correctWord }));
    const response = await POST(req);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);

    const setCookieHeader = response.headers.get("set-cookie");
    expect(setCookieHeader).toBeTruthy();
    expect(setCookieHeader).toContain(PARENT_UNLOCK_COOKIE);
    expect(setCookieHeader).toContain("HttpOnly");
    expect(setCookieHeader).toContain("Path=/");
    expect(setCookieHeader).toMatch(/SameSite=lax/i);
    expect(setCookieHeader).toContain("Max-Age=14400");
  });

  it("case-insensitive safe word works", async () => {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
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

    const repo = getRepo();
    const user = await repo.upsertUserFromSupabase({
      supabaseUserId: "sb-user-1",
      displayName: "Test",
    });
    const hash = await hashSafeWord("MyPassword123");
    await repo.setSafeWordHash(user.id, hash);

    const req = createNextRequest(createUnlockRequest({ safeWord: "mypassword123" }));
    const response = await POST(req);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
  });

  it("trims whitespace from safe word", async () => {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
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

    const repo = getRepo();
    const user = await repo.upsertUserFromSupabase({
      supabaseUserId: "sb-user-1",
      displayName: "Test",
    });
    const hash = await hashSafeWord("MyPassword123");
    await repo.setSafeWordHash(user.id, hash);

    const req = createNextRequest(createUnlockRequest({ safeWord: "  MyPassword123  " }));
    const response = await POST(req);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
  });
});
