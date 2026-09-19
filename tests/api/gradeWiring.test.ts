import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as chatPOST } from "@/app/api/chat/route";
import { GET as perfilGET, PATCH as perfilPATCH } from "@/app/api/perfil/route";
import { resetConfigCache } from "@/lib/config/cache";
import { resetConfigStore } from "@/lib/config/store";
import { getRepo, resetRepo } from "@/lib/db";
import { resetEnvCache } from "@/lib/env";
import { resetRateLimiter } from "@/lib/ratelimit";
import { resetProviderCache } from "@/lib/ai/providers";

vi.mock("@upstash/qstash", () => ({
  Client: vi.fn().mockImplementation(() => ({ publishJSON: vi.fn().mockResolvedValue({}) })),
}));
vi.mock("next/server", async () => {
  const actual = await vi.importActual("next/server");
  return { ...actual, after: vi.fn() };
});
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));

import { createSupabaseServerClient } from "@/lib/supabase/server";

const ENV_KEYS = ["AI_PROVIDER", "OPENROUTER_API_KEY", "ANTHROPIC_API_KEY"];

async function signIn(supabaseId: string, grade?: string) {
  vi.mocked(createSupabaseServerClient).mockResolvedValue({
    auth: { getUser: () => Promise.resolve({ data: { user: { id: supabaseId, email: "a@b.com" } } }) },
  } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);
  return getRepo().upsertUserFromSupabase({ supabaseUserId: supabaseId, ...(grade ? { grade } : {}) });
}

const chatRequest = () =>
  new NextRequest("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sessionId: crypto.randomUUID(),
      messages: [{ id: crypto.randomUUID(), role: "user", content: "¿Qué es una fracción?" }],
    }),
  });

const patch = (payload: unknown) =>
  new NextRequest("http://localhost:3000/api/perfil", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

function reset() {
  for (const key of ENV_KEYS) delete process.env[key];
  resetEnvCache();
  resetRateLimiter();
  resetRepo();
  resetConfigCache();
  resetConfigStore();
  resetProviderCache();
}

let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  reset();
  process.env.OPENROUTER_API_KEY = "test-key";
  process.env.AI_PROVIDER = "openrouter";
  resetEnvCache();
  vi.mocked(createSupabaseServerClient).mockResolvedValue(null);
  vi.spyOn(console, "error").mockImplementation(() => {});
  fetchSpy = vi
    .spyOn(global, "fetch")
    .mockImplementation(
      async () => new Response('data: {"choices":[{"delta":{"content":"Vamos paso a paso: ¿qué parte no ves clara todavía?"}}]}\ndata: [DONE]\n'),
    );
});

afterEach(() => {
  vi.restoreAllMocks();
  reset();
});

/** Prompt de sistema que recibió el modelo en la última petición a OpenRouter. */
async function systemPromptSent(): Promise<string> {
  const call = fetchSpy.mock.calls.find((c: unknown[]) => String(c[0]).includes("chat/completions"));
  if (!call) throw new Error("no hubo petición al modelo");
  return JSON.parse((call[1] as RequestInit).body as string).messages[0].content;
}

describe("el grado del perfil llega al prompt del chat", () => {
  it("una alumna de 9.º grado recibe el prompt adaptado a su nivel", async () => {
    await signIn("sb-9", "9");
    expect((await chatPOST(chatRequest())).status).toBe(200);
    expect(await systemPromptSent()).toContain("estudiantes de 9.º grado (14-15 años)");
  });

  it("kínder también", async () => {
    await signIn("sb-k", "K");
    await chatPOST(chatRequest());
    expect(await systemPromptSent()).toContain("estudiantes de Kínder (5-6 años)");
  });

  it("los grados guardados con el formato antiguo siguen valiendo («1º ESO» = 7.º)", async () => {
    await signIn("sb-eso", "1º ESO");
    await chatPOST(chatRequest());
    expect(await systemPromptSent()).toContain("estudiantes de 7.º grado (12-13 años)");
  });

  it("sin sesión, o con un valor irreconocible, se usa el prompt de siempre (6.º)", async () => {
    await chatPOST(chatRequest());
    expect(await systemPromptSent()).toContain("estudiantes de 6º de primaria (11-12 años)");

    fetchSpy.mockClear();
    await signIn("sb-raro", "no-es-un-grado");
    await chatPOST(chatRequest());
    expect(await systemPromptSent()).toContain("estudiantes de 6º de primaria (11-12 años)");
  });
});

describe("/api/perfil: el grado se valida y se guarda en su forma canónica", () => {
  it("acepta K-12, incluido kínder", async () => {
    await signIn("sb-p1");
    for (const grade of ["K", "1", "6", "12"]) {
      const response = await perfilPATCH(patch({ displayName: "Ana", grade }));
      expect(response.status).toBe(200);
      expect((await response.json()).grade).toBe(grade);
    }
  });

  it("convierte los valores antiguos al canónico", async () => {
    await signIn("sb-p2");
    const response = await perfilPATCH(patch({ displayName: "Ana", grade: "2º ESO" }));
    expect((await response.json()).grade).toBe("8");
    expect((await (await perfilGET()).json()).grade).toBe("8");
  });

  it.each(["", "abc", "0", "13", "5º ESO"])("rechaza el grado %j con 400", async (grade) => {
    await signIn("sb-p3");
    expect((await perfilPATCH(patch({ displayName: "Ana", grade }))).status).toBe(400);
  });
});
