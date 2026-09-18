import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { GET } from "@/app/api/chat/capabilities/route";
import { resetEnvCache } from "@/lib/env";
import { getRepo, resetRepo } from "@/lib/db";

/** Mock Supabase server client */
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

describe("GET /api/chat/capabilities", () => {
  beforeEach(() => {
    resetEnvCache();
    resetRepo();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetEnvCache();
    resetRepo();
  });

  it("returns all-true for anonymous user (no Supabase client)", async () => {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    vi.mocked(createSupabaseServerClient).mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      allowImages: true,
      allowVoice: true,
      allowText: true,
    });
  });

  it("returns all-true for anonymous user (not logged in)", async () => {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: () => Promise.resolve({ data: { user: null } }),
      },
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      allowImages: true,
      allowVoice: true,
      allowText: true,
    });
  });

  it("returns authenticated user's flags when all enabled", async () => {
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
      allowVoice: true,
      allowText: true,
    });

    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      allowImages: true,
      allowVoice: true,
      allowText: true,
    });
  });

  it("returns authenticated user's flags with images disabled", async () => {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
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

    const repo = getRepo();
    const user = await repo.upsertUserFromSupabase({
      supabaseUserId: "sb-user-2",
      displayName: "Test2",
    });
    await repo.updateUserFlags(user.id, {
      allowImages: false,
      allowVoice: true,
      allowText: true,
    });

    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      allowImages: false,
      allowVoice: true,
      allowText: true,
    });
  });

  it("returns authenticated user's flags with voice disabled", async () => {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
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

    const repo = getRepo();
    const user = await repo.upsertUserFromSupabase({
      supabaseUserId: "sb-user-3",
      displayName: "Test3",
    });
    await repo.updateUserFlags(user.id, {
      allowImages: true,
      allowVoice: false,
      allowText: true,
    });

    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      allowImages: true,
      allowVoice: false,
      allowText: true,
    });
  });

  it("returns all-true when user security record not found", async () => {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({
            data: {
              user: { id: "sb-user-unknown", email: "unknown@b.com", user_metadata: {} },
            },
          }),
      },
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    // Don't create the user in the repo, so getUserSecurity returns null
    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      allowImages: true,
      allowVoice: true,
      allowText: true,
    });
  });

  it("returns all-true on error fetching Supabase user", async () => {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: () => Promise.reject(new Error("Supabase error")),
      },
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      allowImages: true,
      allowVoice: true,
      allowText: true,
    });
  });

  it("returns all-true on error fetching user security", async () => {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
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

    const repo = getRepo();
    vi.spyOn(repo, "getUserSecurity").mockRejectedValueOnce(new Error("DB error"));

    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      allowImages: true,
      allowVoice: true,
      allowText: true,
    });
  });

  it("returns all-true on error upserting user", async () => {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: () =>
          Promise.resolve({
            data: {
              user: { id: "sb-user-5", email: "e@b.com", user_metadata: { display_name: "Test5" } },
            },
          }),
      },
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    const repo = getRepo();
    vi.spyOn(repo, "upsertUserFromSupabase").mockRejectedValueOnce(new Error("DB error"));

    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      allowImages: true,
      allowVoice: true,
      allowText: true,
    });
  });
});
