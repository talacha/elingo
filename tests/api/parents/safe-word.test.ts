import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { POST } from "@/app/api/parents/safe-word/route";
import { resetEnvCache } from "@/lib/env";
import { getRepo, resetRepo } from "@/lib/db";
import type { SetSafeWordRequest } from "@/lib/contracts/parents";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

function createSafeWordRequest(overrides?: Partial<SetSafeWordRequest>): SetSafeWordRequest {
  return {
    safeWord: "mySecureWord123",
    ...overrides,
  };
}

function createNextRequest(
  body: SetSafeWordRequest,
  headers?: Record<string, string>
): NextRequest {
  return new NextRequest("http://localhost:3000/api/parents/safe-word", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      ...headers,
    },
  });
}

describe("POST /api/parents/safe-word", () => {
  beforeEach(() => {
    resetEnvCache();
    resetRepo();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetEnvCache();
    resetRepo();
  });

  it("returns 401 if not logged in (no Supabase client)", async () => {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    vi.mocked(createSupabaseServerClient).mockResolvedValue(null);

    const req = createNextRequest(createSafeWordRequest());
    const response = await POST(req);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("unauthorized");
    expect(body.message).toContain("iniciar sesión");
  });

  it("returns 401 if Supabase returns no user", async () => {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: null } }),
      },
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    const req = createNextRequest(createSafeWordRequest());
    const response = await POST(req);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("unauthorized");
  });

  it("returns 400 if safe word is missing", async () => {
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

    const req = createNextRequest({ safeWord: "" });
    const response = await POST(req);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("invalid_request");
  });

  it("returns 400 if safe word is too short", async () => {
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

    const req = createNextRequest(createSafeWordRequest({ safeWord: "abc" }));
    const response = await POST(req);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("invalid_request");
  });

  it("returns 400 if safe word is too long", async () => {
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

    const longWord = "a".repeat(61);
    const req = createNextRequest(createSafeWordRequest({ safeWord: longWord }));
    const response = await POST(req);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("invalid_request");
  });

  it("sets the safe word successfully and stores the hash", async () => {
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

    const safeWord = "mySecureWord123";
    const req = createNextRequest(createSafeWordRequest({ safeWord }));
    const response = await POST(req);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);

    const repo = getRepo();
    const user = await repo.upsertUserFromSupabase({
      supabaseUserId: "sb-user-1",
      displayName: "Test",
    });
    const security = await repo.getUserSecurity(user.id);

    expect(security).not.toBeNull();
    expect(security?.safeWordHash).toBeTruthy();
    expect(security?.safeWordHash).toContain(":");
  });

  it("updates an existing safe word", async () => {
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

    const firstWord = "firstPassword1234";
    const req1 = createNextRequest(createSafeWordRequest({ safeWord: firstWord }));
    const response1 = await POST(req1);
    expect(response1.status).toBe(200);

    let security = await repo.getUserSecurity(user.id);
    const firstHash = security?.safeWordHash;

    const secondWord = "secondPassword5678";
    const req2 = createNextRequest(createSafeWordRequest({ safeWord: secondWord }));
    const response2 = await POST(req2);
    expect(response2.status).toBe(200);

    security = await repo.getUserSecurity(user.id);
    const secondHash = security?.safeWordHash;

    expect(firstHash).not.toBe(secondHash);
  });
});
