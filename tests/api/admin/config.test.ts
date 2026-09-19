import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GET, PUT } from "@/app/api/admin/config/route";
import { getEnv, resetEnvCache } from "@/lib/env";
import { resetRepo } from "@/lib/db";
import {
  getProviderWithOverrides,
  resetAiConfigOverridesCache,
  resetProviderCache,
} from "@/lib/ai/providers";
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

    const entries = [
      ["AI_PROVIDER", "openrouter"],
      ["ANTHROPIC_MODEL", "claude-sonnet-5"],
      ["OPENROUTER_MODEL", "vendor/some-model"],
    ] as const;

    for (const [key, value] of entries) {
      const req = new NextRequest("http://localhost:3000/api/admin/config", {
        method: "PUT",
        body: JSON.stringify({ key, value }),
        headers: { "content-type": "application/json" },
      });

      const response = await PUT(req);
      expect(response.status).toBe(200);
    }
  });

  it("rejects an AI_PROVIDER that is not a known provider (it would leave chat without a provider)", async () => {
    mockAdmin();

    const response = await PUT(putRequest({ key: "AI_PROVIDER", value: "gpt-4" }));
    expect(response.status).toBe(400);
    expect((await response.json()).message).toContain("AI_PROVIDER");
  });

  it("returns 400 (not 500) on a non-JSON body", async () => {
    mockAdmin();

    const req = new NextRequest("http://localhost:3000/api/admin/config", {
      method: "PUT",
      body: "not json",
      headers: { "content-type": "application/json" },
    });
    expect((await PUT(req)).status).toBe(400);
  });

  it("makes the next getProviderWithOverrides call see the change without waiting for the TTL", async () => {
    mockAdmin();
    resetAiConfigOverridesCache();
    resetProviderCache();

    expect((await getProviderWithOverrides(getEnv())).name).toBe("mock");
    expect((await PUT(putRequest({ key: "AI_PROVIDER", value: "openrouter" }))).status).toBe(200);
    expect((await getProviderWithOverrides(getEnv())).name).toBe("openrouter");
  });
});

describe("/api/admin/config effective values", () => {
  beforeEach(() => {
    for (const key of ["AI_PROVIDER", "ANTHROPIC_API_KEY", "OPENROUTER_API_KEY"]) delete process.env[key];
    resetEnvCache();
    resetRepo();
    resetAiConfigOverridesCache();
    resetProviderCache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    for (const key of ["AI_PROVIDER", "ANTHROPIC_API_KEY", "OPENROUTER_API_KEY"]) delete process.env[key];
    resetEnvCache();
    resetRepo();
    resetAiConfigOverridesCache();
    resetProviderCache();
    process.env.ADMIN_EMAILS = "";
  });

  it("GET reports the env-derived provider and models when there are no overrides", async () => {
    mockAdmin();
    process.env.ANTHROPIC_API_KEY = "sk-test";
    resetEnvCache();

    const body = await (await GET()).json();
    expect(body.overrides).toEqual({});
    expect(body.effective.provider).toBe("anthropic");
    expect(body.effective.activeModel).toBe("claude-fable-5-1");
    expect(body.effective.values.ANTHROPIC_MODEL).toBe("claude-fable-5-1");
    expect(body.effective.values.OPENROUTER_MODEL).toBe("deepseek/deepseek-v4-flash-0731:free");
  });

  it("PUT returns the effective config with the override applied", async () => {
    mockAdmin();
    process.env.ANTHROPIC_API_KEY = "sk-test";
    resetEnvCache();

    const body = await (await PUT(putRequest({ key: "ANTHROPIC_MODEL", value: "claude-sonnet-5" }))).json();
    expect(body.overrides.ANTHROPIC_MODEL).toBe("claude-sonnet-5");
    expect(body.effective.activeModel).toBe("claude-sonnet-5");
  });
});

function mockAdmin() {
  const mockSupabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "admin-1", email: "admin@example.com" } },
      }),
    },
  };
  vi.mocked(createSupabaseServerClient).mockResolvedValue(
    mockSupabase as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>,
  );
  process.env.ADMIN_EMAILS = "admin@example.com";
  resetEnvCache();
}

function putRequest(payload: { key: string; value: string }) {
  return new NextRequest("http://localhost:3000/api/admin/config", {
    method: "PUT",
    body: JSON.stringify(payload),
    headers: { "content-type": "application/json" },
  });
}
