import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as chatPOST } from "@/app/api/chat/route";
import { resetProviderCache } from "@/lib/ai/providers";
import { resetConfigCache } from "@/lib/config/cache";
import { resetConfigStore } from "@/lib/config/store";
import { resetRepo } from "@/lib/db";
import { resetEnvCache } from "@/lib/env";
import { resetRateLimiter } from "@/lib/ratelimit";

vi.mock("@upstash/qstash", () => ({
  Client: vi.fn().mockImplementation(() => ({ publishJSON: vi.fn().mockResolvedValue({}) })),
}));
vi.mock("next/server", async () => {
  const actual = await vi.importActual("next/server");
  return { ...actual, after: vi.fn() };
});
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn().mockResolvedValue(null) }));

const ENV_KEYS = ["AI_PROVIDER", "OPENROUTER_API_KEY", "ANTHROPIC_API_KEY"];
let fetchSpy: ReturnType<typeof vi.spyOn>;

type Turn = { role: "user" | "assistant"; content: string };

const request = (messages: Turn[], extra: Record<string, unknown> = {}) =>
  new NextRequest("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sessionId: crypto.randomUUID(),
      messages: messages.map((m) => ({ id: crypto.randomUUID(), ...m })),
      ...extra,
    }),
  });

/** Mensajes de sistema que recibió el modelo en la última petición. */
function systemMessagesSent(): string[] {
  const call = fetchSpy.mock.calls.find((c: unknown[]) => String(c[0]).includes("chat/completions"));
  if (!call) throw new Error("no hubo petición al modelo");
  const body = JSON.parse((call[1] as RequestInit).body as string) as { messages: { role: string; content: string }[] };
  return body.messages.filter((m) => m.role === "system").map((m) => m.content);
}

const subjectHintSent = () => systemMessagesSent().find((m) => m.includes("asignatura:"));

function reset() {
  for (const key of ENV_KEYS) delete process.env[key];
  resetEnvCache();
  resetRateLimiter();
  resetRepo();
  resetConfigCache();
  resetConfigStore();
  resetProviderCache();
}

beforeEach(() => {
  reset();
  process.env.AI_PROVIDER = "openrouter";
  process.env.OPENROUTER_API_KEY = "test-key";
  resetEnvCache();
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

describe("POST /api/chat: la asignatura se deduce del mensaje", () => {
  it("el ejemplo de ciencias llega al modelo como asignatura deducida, sin que la alumna la elija", async () => {
    const response = await chatPOST(
      request([{ role: "user", content: "No me queda claro la diferencia entre evaporación y transpiración" }]),
    );
    expect(response.status).toBe(200);
    expect(subjectHintSent()).toBe("La pregunta de la alumna parece ser de la asignatura: Ciencias.");
  });

  it.each([
    ["Tengo este problema: 3/4 + 1/2, me trabé en el denominador", "Matemáticas"],
    ["¿Cómo identifico el sujeto y predicado en una oración?", "Lengua"],
  ])("%j → %s", async (content, label) => {
    await chatPOST(request([{ role: "user", content }]));
    expect(subjectHintSent()).toContain(label);
  });

  it("una continuación sin pistas conserva el tema de la conversación", async () => {
    await chatPOST(
      request([
        { role: "user", content: "¿Qué es la fotosíntesis?" },
        { role: "assistant", content: "¿Qué crees tú que hacen las plantas con la luz?" },
        { role: "user", content: "no lo sé" },
      ]),
    );
    expect(subjectHintSent()).toContain("Ciencias");
  });

  it("si el mensaje no deja clara ninguna asignatura, no se le dice ninguna al modelo", async () => {
    await chatPOST(request([{ role: "user", content: "ayúdame con mis deberes" }]));
    expect(subjectHintSent()).toBeUndefined();
  });

  it("un cliente antiguo que aún envía `subject` solo lo usa como último recurso", async () => {
    await chatPOST(request([{ role: "user", content: "ayúdame con mis deberes" }], { subject: "lengua" }));
    expect(subjectHintSent()).toContain("Lengua");

    fetchSpy.mockClear();
    await chatPOST(request([{ role: "user", content: "cuánto es 12 : 4" }], { subject: "lengua" }));
    expect(subjectHintSent()).toContain("Matemáticas"); // manda lo que dice el mensaje
  });
});
