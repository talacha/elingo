import { describe, it, expect, beforeEach, vi } from "vitest";
import { proxy } from "@/proxy";
import { resetEnvCache } from "@/lib/env";
import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Mock middleware helper. */
vi.mock("@/lib/supabase/middleware", () => ({
  refreshSupabaseSession: vi.fn(),
}));

/** Mock the Supabase server client. */
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

/** Mock the repo (used by the /admin role check). */
vi.mock("@/lib/db", () => ({
  getRepo: vi.fn(),
}));

function createRequest(pathname: string, options?: { cookie?: string }): NextRequest {
  const headers: Record<string, string> = {};
  if (options?.cookie) {
    headers.cookie = options.cookie;
  }
  return new NextRequest(`http://localhost:3000${pathname}`, {
    method: "GET",
    headers,
  });
}

describe("proxy.ts auth gate (T-032)", () => {
  beforeEach(() => {
    resetEnvCache();
    vi.clearAllMocks();
  });

  describe("AUTH_REQUIRED=false (default)", () => {
    it("allows /chat page access without user", async () => {
      const { refreshSupabaseSession } = await import("@/lib/supabase/middleware");
      const req = createRequest("/chat");
      const mockResponse = NextResponse.next({ request: req });
      vi.mocked(refreshSupabaseSession).mockResolvedValue({
        response: mockResponse,
        supabase: null,
      });

      const response = await proxy(req);

      // Should pass through (not redirect)
      expect(response.status).not.toBe(307);
      expect(response.status).not.toBe(301);
    });

    it("allows /api/chat access without user", async () => {
      const { refreshSupabaseSession } = await import("@/lib/supabase/middleware");
      const req = createRequest("/api/chat");
      const mockResponse = NextResponse.next({ request: req });
      vi.mocked(refreshSupabaseSession).mockResolvedValue({
        response: mockResponse,
        supabase: null,
      });

      const response = await proxy(req);

      // Should pass through (not return 401)
      expect(response.status).not.toBe(401);
    });

    it("allows /api/sessions access without user", async () => {
      const { refreshSupabaseSession } = await import("@/lib/supabase/middleware");
      const req = createRequest("/api/sessions");
      const mockResponse = NextResponse.next({ request: req });
      vi.mocked(refreshSupabaseSession).mockResolvedValue({
        response: mockResponse,
        supabase: null,
      });

      const response = await proxy(req);

      expect(response.status).not.toBe(401);
    });
  });

  describe("AUTH_REQUIRED=true with no user", () => {
    beforeEach(() => {
      process.env.AUTH_REQUIRED = "true";
      resetEnvCache();
    });

    it("redirects /chat page to /login", async () => {
      const { refreshSupabaseSession } = await import("@/lib/supabase/middleware");
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        },
      } as unknown as SupabaseClient;
      const req = createRequest("/chat");
      const mockResponse = NextResponse.next({ request: req });
      vi.mocked(refreshSupabaseSession).mockResolvedValue({
        response: mockResponse,
        supabase: mockSupabase,
      });

      const response = await proxy(req);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("/login");
    });

    it("redirects /chat/[id] page to /login", async () => {
      const { refreshSupabaseSession } = await import("@/lib/supabase/middleware");
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        },
      } as unknown as SupabaseClient;
      const req = createRequest("/chat/some-session-id");
      const mockResponse = NextResponse.next({ request: req });
      vi.mocked(refreshSupabaseSession).mockResolvedValue({
        response: mockResponse,
        supabase: mockSupabase,
      });

      const response = await proxy(req);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("/login");
    });

    it("returns 401 for /api/chat without user", async () => {
      const { refreshSupabaseSession } = await import("@/lib/supabase/middleware");
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        },
      } as unknown as SupabaseClient;
      const req = createRequest("/api/chat");
      const mockResponse = NextResponse.next({ request: req });
      vi.mocked(refreshSupabaseSession).mockResolvedValue({
        response: mockResponse,
        supabase: mockSupabase,
      });

      const response = await proxy(req);

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.error).toBe("unauthorized");
    });

    it("returns 401 for /api/sessions without user", async () => {
      const { refreshSupabaseSession } = await import("@/lib/supabase/middleware");
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        },
      } as unknown as SupabaseClient;
      const req = createRequest("/api/sessions");
      const mockResponse = NextResponse.next({ request: req });
      vi.mocked(refreshSupabaseSession).mockResolvedValue({
        response: mockResponse,
        supabase: mockSupabase,
      });

      const response = await proxy(req);

      expect(response.status).toBe(401);
    });

    it("allows /api/jobs/persist without auth (QStash signature verification)", async () => {
      const { refreshSupabaseSession } = await import("@/lib/supabase/middleware");
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        },
      } as unknown as SupabaseClient;
      const req = createRequest("/api/jobs/persist");
      const mockResponse = NextResponse.next({ request: req });
      vi.mocked(refreshSupabaseSession).mockResolvedValue({
        response: mockResponse,
        supabase: mockSupabase,
      });

      const response = await proxy(req);

      // Should not return 401 (QStash has its own signature verification)
      expect(response.status).not.toBe(401);
    });

    it("allows /login page without auth", async () => {
      const { refreshSupabaseSession } = await import("@/lib/supabase/middleware");
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        },
      } as unknown as SupabaseClient;
      const req = createRequest("/login");
      const mockResponse = NextResponse.next({ request: req });
      vi.mocked(refreshSupabaseSession).mockResolvedValue({
        response: mockResponse,
        supabase: mockSupabase,
      });

      const response = await proxy(req);

      // Should pass through (not redirect or 401)
      expect(response.status).not.toBe(307);
      expect(response.status).not.toBe(301);
      expect(response.status).not.toBe(401);
    });

    it("allows /registro page without auth", async () => {
      const { refreshSupabaseSession } = await import("@/lib/supabase/middleware");
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        },
      } as unknown as SupabaseClient;
      const req = createRequest("/registro");
      const mockResponse = NextResponse.next({ request: req });
      vi.mocked(refreshSupabaseSession).mockResolvedValue({
        response: mockResponse,
        supabase: mockSupabase,
      });

      const response = await proxy(req);

      expect(response.status).not.toBe(307);
      expect(response.status).not.toBe(301);
      expect(response.status).not.toBe(401);
    });
  });

  describe("AUTH_REQUIRED=true with authenticated user", () => {
    beforeEach(() => {
      process.env.AUTH_REQUIRED = "true";
      resetEnvCache();
    });

    it("allows /chat page with authenticated user", async () => {
      const { refreshSupabaseSession } = await import("@/lib/supabase/middleware");
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "user-123", user_metadata: {} } },
          }),
        },
      } as unknown as SupabaseClient;
      const req = createRequest("/chat");
      const mockResponse = NextResponse.next({ request: req });
      vi.mocked(refreshSupabaseSession).mockResolvedValue({
        response: mockResponse,
        supabase: mockSupabase,
      });

      const response = await proxy(req);

      // Should not redirect
      expect(response.status).not.toBe(307);
      expect(response.status).not.toBe(301);
    });

    it("allows /api/chat with authenticated user", async () => {
      const { refreshSupabaseSession } = await import("@/lib/supabase/middleware");
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "user-123", user_metadata: {} } },
          }),
        },
      } as unknown as SupabaseClient;
      const req = createRequest("/api/chat");
      const mockResponse = NextResponse.next({ request: req });
      vi.mocked(refreshSupabaseSession).mockResolvedValue({
        response: mockResponse,
        supabase: mockSupabase,
      });

      const response = await proxy(req);

      // Should not return 401
      expect(response.status).not.toBe(401);
    });

    it("allows /api/sessions with authenticated user", async () => {
      const { refreshSupabaseSession } = await import("@/lib/supabase/middleware");
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "user-123", user_metadata: {} } },
          }),
        },
      } as unknown as SupabaseClient;
      const req = createRequest("/api/sessions");
      const mockResponse = NextResponse.next({ request: req });
      vi.mocked(refreshSupabaseSession).mockResolvedValue({
        response: mockResponse,
        supabase: mockSupabase,
      });

      const response = await proxy(req);

      expect(response.status).not.toBe(401);
    });
  });

  describe("Supabase not configured", () => {
    beforeEach(() => {
      process.env.AUTH_REQUIRED = "true";
      resetEnvCache();
    });

    it("treats missing Supabase client as unauthenticated", async () => {
      const { refreshSupabaseSession } = await import("@/lib/supabase/middleware");
      const req = createRequest("/api/chat");
      const mockResponse = NextResponse.next({ request: req });
      vi.mocked(refreshSupabaseSession).mockResolvedValue({
        response: mockResponse,
        supabase: null, // No Supabase configured
      });

      const response = await proxy(req);

      expect(response.status).toBe(401);
    });
  });

  describe("/admin gate (always on, independent of AUTH_REQUIRED)", () => {
    it("redirects to /login when not authenticated", async () => {
      const { refreshSupabaseSession } = await import("@/lib/supabase/middleware");
      const req = createRequest("/admin");
      const mockResponse = NextResponse.next({ request: req });
      vi.mocked(refreshSupabaseSession).mockResolvedValue({
        response: mockResponse,
        supabase: null,
      });

      const response = await proxy(req);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("/login");
    });

    it("redirects a logged-in non-admin to /", async () => {
      const { refreshSupabaseSession } = await import("@/lib/supabase/middleware");
      const { getRepo } = await import("@/lib/db");
      const mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      } as unknown as SupabaseClient;
      vi.mocked(getRepo).mockReturnValue({
        upsertUserFromSupabase: vi.fn().mockResolvedValue({ role: "parent" }),
      } as never);
      const req = createRequest("/admin/settings");
      const mockResponse = NextResponse.next({ request: req });
      vi.mocked(refreshSupabaseSession).mockResolvedValue({
        response: mockResponse,
        supabase: mockSupabase,
      });

      const response = await proxy(req);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toMatch(/\/$/);
    });

    it("allows a logged-in admin through", async () => {
      const { refreshSupabaseSession } = await import("@/lib/supabase/middleware");
      const { getRepo } = await import("@/lib/db");
      const mockSupabase = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      } as unknown as SupabaseClient;
      vi.mocked(getRepo).mockReturnValue({
        upsertUserFromSupabase: vi.fn().mockResolvedValue({ role: "admin" }),
      } as never);
      const req = createRequest("/admin");
      const mockResponse = NextResponse.next({ request: req });
      vi.mocked(refreshSupabaseSession).mockResolvedValue({
        response: mockResponse,
        supabase: mockSupabase,
      });

      const response = await proxy(req);

      expect(response.status).not.toBe(307);
      expect(response.status).not.toBe(301);
    });

    it("gates /admin even when AUTH_REQUIRED is false (the app default)", async () => {
      process.env.AUTH_REQUIRED = "false";
      resetEnvCache();
      const { refreshSupabaseSession } = await import("@/lib/supabase/middleware");
      const req = createRequest("/admin");
      const mockResponse = NextResponse.next({ request: req });
      vi.mocked(refreshSupabaseSession).mockResolvedValue({
        response: mockResponse,
        supabase: null,
      });

      const response = await proxy(req);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("/login");
    });
  });
});
