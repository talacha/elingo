import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PUT as putGlobalFlag } from "@/app/api/admin/flags/route";
import { PUT as putAccountFlag } from "@/app/api/admin/users/flags/route";
import { GET as getUsers } from "@/app/api/admin/users/route";
import { GET as getConfig } from "@/app/api/admin/config/route";
import { resetAiConfigOverridesCache } from "@/lib/ai/providers";
import { getRepo, resetRepo } from "@/lib/db";
import { resetEnvCache } from "@/lib/env";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { createSupabaseServerClient } from "@/lib/supabase/server";

function mockAdmin(email = "admin@example.com") {
  vi.mocked(createSupabaseServerClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "admin-1", email } } }) },
  } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);
  process.env.ADMIN_EMAILS = "admin@example.com";
  resetEnvCache();
}

const req = (path: string, payload: unknown) =>
  new NextRequest(`http://localhost:3000${path}`, {
    method: "PUT",
    body: typeof payload === "string" ? payload : JSON.stringify(payload),
    headers: { "content-type": "application/json" },
  });

function reset() {
  delete process.env.ADMIN_EMAILS;
  resetEnvCache();
  resetRepo();
  resetAiConfigOverridesCache();
}

beforeEach(() => {
  reset();
  vi.clearAllMocks();
});
afterEach(reset);

describe("PUT /api/admin/flags (global)", () => {
  it("returns 404 for non-admins", async () => {
    mockAdmin("notadmin@example.com");
    expect((await putGlobalFlag(req("/api/admin/flags", { flag: "voice_mode", enabled: false }))).status).toBe(404);
  });

  it("returns 400 for an unknown flag, a non-boolean or a non-JSON body", async () => {
    mockAdmin();
    expect((await putGlobalFlag(req("/api/admin/flags", { flag: "nope", enabled: false }))).status).toBe(400);
    expect((await putGlobalFlag(req("/api/admin/flags", { flag: "voice_mode", enabled: "no" }))).status).toBe(400);
    expect((await putGlobalFlag(req("/api/admin/flags", "not json"))).status).toBe(400);
  });

  it("turns a flag off for everyone, persists it in Postgres and returns it in the config", async () => {
    mockAdmin();
    const body = await (await putGlobalFlag(req("/api/admin/flags", { flag: "image_mode", enabled: false }))).json();

    expect(body.flags.find((f: { key: string }) => f.key === "image_mode").enabled).toBe(false);
    expect(body.flags.find((f: { key: string }) => f.key === "voice_mode").enabled).toBe(true);
    expect((await getRepo().getAiConfig())["flag.image_mode"]).toBe("false");

    const again = await (await getConfig()).json();
    expect(again.flags.find((f: { key: string }) => f.key === "image_mode").enabled).toBe(false);
  });

  it("turns it back on", async () => {
    mockAdmin();
    await putGlobalFlag(req("/api/admin/flags", { flag: "voice_mode", enabled: false }));
    const body = await (await putGlobalFlag(req("/api/admin/flags", { flag: "voice_mode", enabled: true }))).json();
    expect(body.flags.find((f: { key: string }) => f.key === "voice_mode").enabled).toBe(true);
  });
});

describe("PUT /api/admin/users/flags (per account)", () => {
  it("returns 404 for non-admins", async () => {
    mockAdmin("notadmin@example.com");
    const userId = crypto.randomUUID();
    expect(
      (await putAccountFlag(req("/api/admin/users/flags", { userId, flag: "voice_mode", enabled: false }))).status,
    ).toBe(404);
  });

  it("returns 400 for a bad userId, unknown flag or missing enabled", async () => {
    mockAdmin();
    const userId = crypto.randomUUID();
    expect(
      (await putAccountFlag(req("/api/admin/users/flags", { userId: "x", flag: "voice_mode", enabled: false }))).status,
    ).toBe(400);
    expect(
      (await putAccountFlag(req("/api/admin/users/flags", { userId, flag: "nope", enabled: false }))).status,
    ).toBe(400);
    expect((await putAccountFlag(req("/api/admin/users/flags", { userId, flag: "voice_mode" }))).status).toBe(400);
  });

  it("turns a flag off for one account and lists it in /api/admin/users; null removes the override", async () => {
    mockAdmin();
    const repo = getRepo();
    const user = await repo.upsertUserFromSupabase({ supabaseUserId: "sb-flags-1" });
    const other = await repo.upsertUserFromSupabase({ supabaseUserId: "sb-flags-2" });

    const off = await putAccountFlag(req("/api/admin/users/flags", { userId: user.id, flag: "voice_mode", enabled: false }));
    expect(off.status).toBe(200);

    const listed = (await (await getUsers()).json()).users as { id: string; flagOverrides: Record<string, boolean> }[];
    expect(listed.find((u) => u.id === user.id)?.flagOverrides).toEqual({ voice_mode: false });
    expect(listed.find((u) => u.id === other.id)?.flagOverrides).toEqual({});

    await putAccountFlag(req("/api/admin/users/flags", { userId: user.id, flag: "voice_mode", enabled: null }));
    const after = (await (await getUsers()).json()).users as { id: string; flagOverrides: Record<string, boolean> }[];
    expect(after.find((u) => u.id === user.id)?.flagOverrides).toEqual({});
  });
});
