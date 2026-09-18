import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GET } from "@/app/api/parents/insights/route";
import { NextRequest } from "next/server";
import { resetEnvCache } from "@/lib/env";
import { resetParentUnlockMemory, createUnlockToken } from "@/lib/auth/parentUnlock";
import { resetRepo, getRepo } from "@/lib/db";
import { PARENT_UNLOCK_COOKIE } from "@/lib/contracts/parents";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/ratelimit/upstash", () => ({
  hasRedisCredentials: vi.fn(() => false),
  createRedisFromEnv: vi.fn(),
}));

function createInsightsRequest(
  overrides?: {
    headers?: Record<string, string>;
  }
): NextRequest {
  return new NextRequest("http://localhost:3000/api/parents/insights", {
    method: "GET",
    headers: overrides?.headers ?? {},
  });
}

describe("GET /api/parents/insights", () => {
  beforeEach(() => {
    resetEnvCache();
    resetParentUnlockMemory();
    resetRepo();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetEnvCache();
    resetParentUnlockMemory();
    resetRepo();
  });

  it("returns 401 if user is not authenticated", async () => {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    vi.mocked(createSupabaseServerClient).mockResolvedValue(null);

    const req = createInsightsRequest();
    const response = await GET(req);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe("unauthorized");
  });

  it("returns 401 if Supabase user is not present", async () => {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    };
    vi.mocked(createSupabaseServerClient).mockResolvedValue(mockSupabase as never);

    const req = createInsightsRequest();
    const response = await GET(req);

    expect(response.status).toBe(401);
  });

  it("returns 401 if unlock cookie is missing", async () => {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "user-123",
              user_metadata: { display_name: "Test User" },
            },
          },
        }),
      },
    };
    vi.mocked(createSupabaseServerClient).mockResolvedValue(mockSupabase as never);

    const req = createInsightsRequest();
    const response = await GET(req);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.message).toContain("desbloquear");
  });

  it("returns 401 if unlock token is invalid", async () => {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "user-123",
              user_metadata: { display_name: "Test User" },
            },
          },
        }),
      },
    };
    vi.mocked(createSupabaseServerClient).mockResolvedValue(mockSupabase as never);

    const req = createInsightsRequest({
      headers: { cookie: `${PARENT_UNLOCK_COOKIE}=invalid-token` },
    });
    const response = await GET(req);

    expect(response.status).toBe(401);
  });

  it("returns 200 with empty subjects if no activity", async () => {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "supabase-user-123",
              user_metadata: { display_name: "Test User" },
            },
          },
        }),
      },
    };
    vi.mocked(createSupabaseServerClient).mockResolvedValue(mockSupabase as never);

    // First, upsert the user to get the app's internal userId
    const repo = getRepo();
    const user = await repo.upsertUserFromSupabase({
      supabaseUserId: "supabase-user-123",
      displayName: "Test User",
    });
    const userId = user.id;

    // Create a valid unlock token with the app's userId
    const token = await createUnlockToken(userId);

    const req = createInsightsRequest({
      headers: { cookie: `${PARENT_UNLOCK_COOKIE}=${token}` },
    });

    const response = await GET(req);
    const text = await response.text();

    expect(response.status).toBe(200);
    const data = JSON.parse(text);
    expect(data.hasSafeWord).toBe(false);
    expect(data.settings).toBeDefined();
    expect(Array.isArray(data.subjects)).toBe(true);
  });

  it("returns 200 with correct structure when unlocked and authenticated", async () => {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "supabase-user-456",
              user_metadata: { display_name: "Another User" },
            },
          },
        }),
      },
    };
    vi.mocked(createSupabaseServerClient).mockResolvedValue(mockSupabase as never);

    // Upsert user to get the app's internal userId
    const repo = getRepo();
    const user = await repo.upsertUserFromSupabase({
      supabaseUserId: "supabase-user-456",
      displayName: "Another User",
    });
    const userId = user.id;

    const token = await createUnlockToken(userId);

    const req = createInsightsRequest({
      headers: { cookie: `${PARENT_UNLOCK_COOKIE}=${token}` },
    });
    const response = await GET(req);

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data).toHaveProperty("hasSafeWord");
    expect(data).toHaveProperty("settings");
    expect(data.settings).toHaveProperty("allowImages");
    expect(data.settings).toHaveProperty("allowVoice");
    expect(data.settings).toHaveProperty("allowText");
    expect(Array.isArray(data.subjects)).toBe(true);
  });
});
