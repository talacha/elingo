import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, PUT } from "@/app/api/admin/config/route";
import { getProviderWithOverrides, resetAiConfigOverridesCache, resetProviderCache } from "@/lib/ai/providers";
import { getRepo, resetRepo } from "@/lib/db";
import { getEnv, resetEnvCache } from "@/lib/env";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { createSupabaseServerClient } from "@/lib/supabase/server";

const ENV_KEYS = ["ADMIN_EMAILS", "AI_PROVIDER", "ANTHROPIC_API_KEY", "OPENROUTER_API_KEY"];
const BASE = "nvidia/nemotron-3.5-lightning:free";
const OMNI = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free";

/** Catálogo de OpenRouter reducido: el modelo base es solo de texto; el omni acepta imagen y audio. */
const CATALOG = {
  data: [
    { id: BASE, architecture: { input_modalities: ["text"] } },
    { id: OMNI, architecture: { input_modalities: ["text", "audio", "image", "video"] } },
    { id: "openrouter/free", architecture: { input_modalities: ["text", "image"] } },
    { id: "vendor/some-model", architecture: { input_modalities: ["text"] } },
  ],
};

let fetchSpy: ReturnType<typeof vi.spyOn>;

function mockAdmin(email = "admin@example.com") {
  vi.mocked(createSupabaseServerClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "admin-1", email } } }) },
  } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);
  process.env.ADMIN_EMAILS = "admin@example.com";
  resetEnvCache();
}

const jsonRequest = (method: string, payload: unknown) =>
  new NextRequest("http://localhost:3000/api/admin/config", {
    method,
    body: typeof payload === "string" ? payload : JSON.stringify(payload),
    headers: { "content-type": "application/json" },
  });
const put = (key: string, value: string) => PUT(jsonRequest("PUT", { key, value }));

function reset() {
  for (const key of ENV_KEYS) delete process.env[key];
  resetEnvCache();
  resetRepo();
  resetProviderCache();
  resetAiConfigOverridesCache();
}

beforeEach(() => {
  reset();
  vi.clearAllMocks();
  fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async () => new Response(JSON.stringify(CATALOG)));
});

afterEach(() => {
  fetchSpy.mockRestore();
  reset();
});

describe("GET /api/admin/config", () => {
  it("returns 404 when Supabase is not configured", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue(null);
    expect((await GET()).status).toBe(404);
  });

  it("returns 404 when the user is not an admin", async () => {
    mockAdmin("notadmin@example.com");
    expect((await GET()).status).toBe(404);
  });

  it("lists every parameter with its effective value and the flags", async () => {
    mockAdmin();

    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();

    const byKey = Object.fromEntries(body.params.map((p: { key: string }) => [p.key, p]));
    expect(byKey.base_model).toMatchObject({ value: BASE, source: "env", editable: true, capability: "text" });
    expect(byKey.visual_model).toMatchObject({ value: OMNI, capability: "image" });
    expect(byKey.speech_model).toMatchObject({ value: OMNI, capability: "audio" });
    expect(byKey.rate_limit_max).toMatchObject({ editable: false });
    expect(byKey.ai_provider.options).toEqual(["anthropic", "openrouter", "mock"]);

    expect(body.flags.map((f: { key: string; enabled: boolean }) => [f.key, f.enabled])).toEqual([
      ["voice_mode", true],
      ["image_mode", true],
    ]);
  });

  it("reports the provider and model that actually serve the chat (fixes /admin not showing the active model)", async () => {
    mockAdmin();
    process.env.OPENROUTER_API_KEY = "k";
    resetEnvCache();

    const body = await (await GET()).json();
    expect(body.provider).toBe("openrouter");
    expect(body.activeModel).toBe(BASE);
  });

  it("falls back to the environment values when Postgres is unreachable (never breaks /admin)", async () => {
    mockAdmin();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(getRepo(), "getAiConfig").mockRejectedValue(new Error("boom"));

    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.params.find((p: { key: string }) => p.key === "base_model").source).toBe("env");
    error.mockRestore();
  });
});

describe("PUT /api/admin/config", () => {
  it("returns 404 when not authenticated or not an admin", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue(null);
    expect((await put("base_model", "openrouter/free")).status).toBe(404);
    mockAdmin("notadmin@example.com");
    expect((await put("base_model", "openrouter/free")).status).toBe(404);
  });

  it.each([
    ["unknown key", "nope", "x"],
    ["read-only param", "rate_limit_max", "5"],
    ["empty value", "base_model", "   "],
    ["value too long", "anthropic_model", "x".repeat(201)],
    ["unknown provider", "ai_provider", "gpt-4"],
    ["int below the minimum", "ai_max_output_tokens", "1"],
    ["int above the maximum", "ai_window_pairs", "999"],
    ["non-integer int", "ai_max_input_chars", "12.5"],
  ])("returns 400 for %s", async (_label, key, value) => {
    mockAdmin();
    const response = await put(key, value);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("invalid_request");
  });

  it("returns 400 (not 500) on a non-JSON body", async () => {
    mockAdmin();
    expect((await PUT(jsonRequest("PUT", "not json"))).status).toBe(400);
  });

  it("rejects a visual_model that cannot read images (the nemotron-3.5-lightning case)", async () => {
    mockAdmin();
    const response = await put("visual_model", BASE);
    expect(response.status).toBe(400);
    expect((await response.json()).message).toContain("no acepta imágenes");
  });

  it("rejects a speech_model that cannot take audio", async () => {
    mockAdmin();
    const response = await put("speech_model", "openrouter/free");
    expect(response.status).toBe(400);
    expect((await response.json()).message).toContain("no acepta audio");
  });

  it("rejects a model that is not in the OpenRouter catalog", async () => {
    mockAdmin();
    const response = await put("base_model", "vendor/does-not-exist");
    expect(response.status).toBe(400);
    expect((await response.json()).message).toContain("no está en el catálogo");
  });

  it("accepts models that do have the capability", async () => {
    mockAdmin();
    expect((await put("base_model", "openrouter/free")).status).toBe(200);
    expect((await put("visual_model", "openrouter/free")).status).toBe(200);
    expect((await put("speech_model", OMNI)).status).toBe(200);
  });

  it("still saves when the OpenRouter catalog is unreachable (never blocks a change)", async () => {
    mockAdmin();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchSpy.mockRejectedValue(new Error("offline"));
    expect((await put("visual_model", "any/model")).status).toBe(200);
    warn.mockRestore();
  });

  it("stores the value in Postgres (repo) trimmed, with the admin email for audit", async () => {
    mockAdmin();
    const setSpy = vi.spyOn(getRepo(), "setAiConfig");
    const body = await (await put("base_model", " openrouter/free ")).json();

    expect(setSpy).toHaveBeenCalledWith("base_model", "openrouter/free", "admin@example.com");
    expect((await getRepo().getAiConfig()).base_model).toBe("openrouter/free");
    expect(body.params.find((p: { key: string }) => p.key === "base_model")).toMatchObject({
      value: "openrouter/free",
      source: "db",
    });
  });

  it("applies the change to the very next chat request (cache invalidated on write)", async () => {
    mockAdmin();
    process.env.OPENROUTER_API_KEY = "k";
    resetEnvCache();

    const before = await getProviderWithOverrides(getEnv());
    expect(before.model).toBe(BASE);

    expect((await put("base_model", "openrouter/free")).status).toBe(200);
    expect((await getProviderWithOverrides(getEnv())).model).toBe("openrouter/free");
  });

  it("switches provider and reports the new active model", async () => {
    mockAdmin();
    process.env.ANTHROPIC_API_KEY = "sk";
    process.env.OPENROUTER_API_KEY = "k";
    resetEnvCache();

    expect((await (await GET()).json()).provider).toBe("anthropic");
    const body = await (await put("ai_provider", "openrouter")).json();
    expect(body.provider).toBe("openrouter");
    expect(body.activeModel).toBe(BASE);
  });
});

describe("DELETE /api/admin/config", () => {
  it("returns 404 for non-admins", async () => {
    mockAdmin("notadmin@example.com");
    expect((await DELETE(jsonRequest("DELETE", { key: "base_model" }))).status).toBe(404);
  });

  it("removes the stored value so the parameter goes back to the environment", async () => {
    mockAdmin();
    await put("base_model", "openrouter/free");
    const body = await (await DELETE(jsonRequest("DELETE", { key: "base_model" }))).json();

    expect(body.params.find((p: { key: string }) => p.key === "base_model")).toMatchObject({
      value: BASE,
      source: "env",
    });
    expect((await getRepo().getAiConfig()).base_model).toBeUndefined();
  });

  it("returns 400 for an unknown or read-only key", async () => {
    mockAdmin();
    expect((await DELETE(jsonRequest("DELETE", { key: "nope" }))).status).toBe(400);
    expect((await DELETE(jsonRequest("DELETE", { key: "rate_limit_max" }))).status).toBe(400);
    expect((await DELETE(jsonRequest("DELETE", "not json"))).status).toBe(400);
  });
});
