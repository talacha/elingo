import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GET } from "@/app/api/admin/users/route";
import { resetEnvCache } from "@/lib/env";
import { resetRepo } from "@/lib/db";

/** Mock Supabase client. */
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { createSupabaseServerClient } from "@/lib/supabase/server";

describe("GET /api/admin/users", () => {
  beforeEach(() => {
    resetEnvCache();
    resetRepo();
    vi.clearAllMocks();
    process.env.ADMIN_EMAILS = "";
  });

  afterEach(() => {
    resetEnvCache();
    resetRepo();
    vi.clearAllMocks();
    process.env.ADMIN_EMAILS = "";
  });

  it("returns 404 when not authenticated", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue(null);


    const response = await GET();
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.error).toBe("not_found");
  });

  it("returns 404 when user is not an admin", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1", email: "notadmin@example.com" } },
        }),
      },
    };

    vi.mocked(createSupabaseServerClient).mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);
    process.env.ADMIN_EMAILS = "admin@example.com";
    resetEnvCache();


    const response = await GET();
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.error).toBe("not_found");
  });

  it("returns 200 with users list when authenticated as admin", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "admin-1", email: "admin@example.com" } },
        }),
      },
    };

    vi.mocked(createSupabaseServerClient).mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);
    process.env.ADMIN_EMAILS = "admin@example.com";
    resetEnvCache();


    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty("users");
    expect(Array.isArray(body.users)).toBe(true);
  });

  it("returns 404 when user email is not in ADMIN_EMAILS list", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-2", email: "other@example.com" } },
        }),
      },
    };

    vi.mocked(createSupabaseServerClient).mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);
    process.env.ADMIN_EMAILS = "admin1@example.com,admin2@example.com";
    resetEnvCache();


    const response = await GET();
    expect(response.status).toBe(404);
  });

  it("handles whitespace in ADMIN_EMAILS", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "admin-1", email: "admin@example.com" } },
        }),
      },
    };

    vi.mocked(createSupabaseServerClient).mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);
    process.env.ADMIN_EMAILS = " admin@example.com , other@example.com ";
    resetEnvCache();


    const response = await GET();
    expect(response.status).toBe(200);
  });
});
