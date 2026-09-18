import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { GET, PATCH } from "@/app/api/parents/settings/route";
import { resetEnvCache } from "@/lib/env";
import { getRepo, resetRepo } from "@/lib/db";
import { hashSafeWord } from "@/lib/auth/safeWord";
import { createUnlockToken, resetParentUnlockMemory } from "@/lib/auth/parentUnlock";
import { PARENT_UNLOCK_COOKIE } from "@/lib/contracts/parents";
import type { ParentSettingsPatch } from "@/lib/contracts/parents";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

function createSettingsRequest(
  overrides?: Partial<ParentSettingsPatch>
): ParentSettingsPatch {
  return {
    ...overrides,
  };
}

function createNextRequest(
  body?: ParentSettingsPatch,
  method: "GET" | "PATCH" = "GET",
  unlockToken?: string,
  headers?: Record<string, string>
): NextRequest {
  const cookie = unlockToken ? `${PARENT_UNLOCK_COOKIE}=${unlockToken}` : undefined;
  return new NextRequest("http://localhost:3000/api/parents/settings", {
    method,
    ...(body && { body: JSON.stringify(body) }),
    headers: {
      "content-type": "application/json",
      ...(cookie && { cookie }),
      ...headers,
    },
  });
}

describe("GET/PATCH /api/parents/settings", () => {
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

  describe("GET", () => {
    it("returns 401 if not logged in", async () => {
      const { createSupabaseServerClient } = await import("@/lib/supabase/server");
      vi.mocked(createSupabaseServerClient).mockResolvedValue(null);

      const req = createNextRequest();
      const response = await GET(req);

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe("unauthorized");
      expect(body.message).toContain("iniciar sesión");
    });

    it("returns 401 if not unlocked (no cookie)", async () => {
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

      const req = createNextRequest();
      const response = await GET(req);

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe("unauthorized");
      expect(body.message).toContain("desbloquear");
    });

    it("returns 401 if unlock token is invalid", async () => {
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

      const req = createNextRequest(undefined, "GET", "invalid-token-123");
      const response = await GET(req);

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe("unauthorized");
    });

    it("returns settings when unlocked", async () => {
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

      const token = await createUnlockToken(user.id);

      const req = createNextRequest(undefined, "GET", token);
      const response = await GET(req);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.allowImages).toBeDefined();
      expect(body.allowVoice).toBeDefined();
      expect(body.allowText).toBeDefined();
      expect(typeof body.allowImages).toBe("boolean");
      expect(typeof body.allowVoice).toBe("boolean");
      expect(typeof body.allowText).toBe("boolean");
      expect(body.safeWordHash).toBeUndefined();
    });

    it("does not leak safeWordHash in response", async () => {
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

      const token = await createUnlockToken(user.id);

      const req = createNextRequest(undefined, "GET", token);
      const response = await GET(req);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.safeWordHash).toBeUndefined();
    });
  });

  describe("PATCH", () => {
    it("returns 401 if not logged in", async () => {
      const { createSupabaseServerClient } = await import("@/lib/supabase/server");
      vi.mocked(createSupabaseServerClient).mockResolvedValue(null);

      const req = createNextRequest(createSettingsRequest({ allowImages: true }), "PATCH");
      const response = await PATCH(req);

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe("unauthorized");
    });

    it("returns 401 if not unlocked", async () => {
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

      const req = createNextRequest(createSettingsRequest({ allowImages: true }), "PATCH");
      const response = await PATCH(req);

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe("unauthorized");
      expect(body.message).toContain("desbloquear");
    });

    it("returns 400 if body is invalid", async () => {
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
      const token = await createUnlockToken(user.id);

      const req = createNextRequest(
        { allowImages: "not a boolean" } as unknown as ParentSettingsPatch,
        "PATCH",
        token,
      );
      const response = await PATCH(req);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe("invalid_request");
    });

    it("updates a single flag (allowImages)", async () => {
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
      const token = await createUnlockToken(user.id);

      const initialSettings = await repo.getUserSecurity(user.id);
      const oldAllowVoice = initialSettings?.allowVoice;
      const oldAllowText = initialSettings?.allowText;

      const req = createNextRequest(
        createSettingsRequest({ allowImages: false }),
        "PATCH",
        token
      );
      const response = await PATCH(req);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.allowImages).toBe(false);
      expect(body.allowVoice).toBe(oldAllowVoice);
      expect(body.allowText).toBe(oldAllowText);
    });

    it("updates multiple flags", async () => {
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
      const token = await createUnlockToken(user.id);

      const req = createNextRequest(
        createSettingsRequest({ allowImages: false, allowVoice: true }),
        "PATCH",
        token
      );
      const response = await PATCH(req);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.allowImages).toBe(false);
      expect(body.allowVoice).toBe(true);
      expect(body.allowText).toBeDefined();
    });

    it("partial PATCH leaves untouched flags unchanged", async () => {
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

      await repo.updateUserFlags(user.id, {
        allowImages: true,
        allowVoice: false,
        allowText: true,
      });

      const token = await createUnlockToken(user.id);

      const req = createNextRequest(
        createSettingsRequest({ allowImages: false }),
        "PATCH",
        token
      );
      const response = await PATCH(req);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.allowImages).toBe(false);
      expect(body.allowVoice).toBe(false);
      expect(body.allowText).toBe(true);
    });

    it("empty PATCH (no fields) still succeeds and returns current state", async () => {
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

      await repo.updateUserFlags(user.id, {
        allowImages: true,
        allowVoice: false,
        allowText: true,
      });

      const token = await createUnlockToken(user.id);

      const req = createNextRequest(createSettingsRequest(), "PATCH", token);
      const response = await PATCH(req);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.allowImages).toBe(true);
      expect(body.allowVoice).toBe(false);
      expect(body.allowText).toBe(true);
    });
  });
});
