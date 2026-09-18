import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GET, PUT } from "@/app/api/admin/config/route";
import { resetEnvCache } from "@/lib/env";
import { resetRepo } from "@/lib/db";
import { NextRequest } from "next/server";

/** Mock Supabase client. */
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { createSupabaseServerClient } from "@/lib/supabase/server";

describe("GET /api/admin/config", () => {
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
  });

  it("returns 200 with config overrides when authenticated as admin", async () => {
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
    expect(body).toHaveProperty("overrides");
    expect(typeof body.overrides).toBe("object");
  });
});

describe("PUT /api/admin/config", () => {
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

    const req = new NextRequest("http://localhost:3000/api/admin/config", {
      method: "PUT",
      body: JSON.stringify({ key: "AI_PROVIDER", value: "anthropic" }),
      headers: { "content-type": "application/json" },
    });

    const response = await PUT(req);
    expect(response.status).toBe(404);
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

    const req = new NextRequest("http://localhost:3000/api/admin/config", {
      method: "PUT",
      body: JSON.stringify({ key: "AI_PROVIDER", value: "anthropic" }),
      headers: { "content-type": "application/json" },
    });

    const response = await PUT(req);
    expect(response.status).toBe(404);
  });

  it("returns 400 with invalid key", async () => {
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

    const req = new NextRequest("http://localhost:3000/api/admin/config", {
      method: "PUT",
      body: JSON.stringify({ key: "INVALID_KEY", value: "some-value" }),
      headers: { "content-type": "application/json" },
    });

    const response = await PUT(req);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("invalid_request");
  });

  it("returns 400 with empty value", async () => {
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

    const req = new NextRequest("http://localhost:3000/api/admin/config", {
      method: "PUT",
      body: JSON.stringify({ key: "AI_PROVIDER", value: "" }),
      headers: { "content-type": "application/json" },
    });

    const response = await PUT(req);
    expect(response.status).toBe(400);
  });

  it("returns 400 with value too long", async () => {
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

    const req = new NextRequest("http://localhost:3000/api/admin/config", {
      method: "PUT",
      body: JSON.stringify({ key: "AI_PROVIDER", value: "x".repeat(201) }),
      headers: { "content-type": "application/json" },
    });

    const response = await PUT(req);
    expect(response.status).toBe(400);
  });

  it("saves config and returns 200 with fresh overrides", async () => {
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

    const req = new NextRequest("http://localhost:3000/api/admin/config", {
      method: "PUT",
      body: JSON.stringify({ key: "AI_PROVIDER", value: "anthropic" }),
      headers: { "content-type": "application/json" },
    });

    const response = await PUT(req);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty("overrides");
    expect(typeof body.overrides).toBe("object");
    // The saved value should be in the overrides
    expect(body.overrides.AI_PROVIDER).toBe("anthropic");
  });

  it("allows all valid AI_CONFIG_KEYS", async () => {
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

    const keys = ["AI_PROVIDER", "ANTHROPIC_MODEL", "OPENROUTER_MODEL"] as const;

    for (const key of keys) {
      const req = new NextRequest("http://localhost:3000/api/admin/config", {
        method: "PUT",
        body: JSON.stringify({ key, value: "test-value" }),
        headers: { "content-type": "application/json" },
      });

      const response = await PUT(req);
      expect(response.status).toBe(200);
    }
  });
});
