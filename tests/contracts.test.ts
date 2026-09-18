import { afterEach, describe, expect, it } from "vitest";
import { chatRequestSchema } from "@/lib/contracts/chat";
import { getEnv, resetEnvCache, resolveProvider } from "@/lib/env";
import { MemoryRateLimiter, parseWindow } from "@/lib/ratelimit/memory";

const uuid = () => crypto.randomUUID();

describe("contrato POST /api/chat", () => {
  it("acepta una petición válida", () => {
    const parsed = chatRequestSchema.safeParse({
      sessionId: uuid(),
      subject: "mates",
      messages: [{ id: uuid(), role: "user", content: "Tengo este problema: 3/4 + 1/2" }],
    });
    expect(parsed.success).toBe(true);
  });

  it("rechaza mensajes vacíos y asignaturas desconocidas", () => {
    expect(chatRequestSchema.safeParse({ sessionId: uuid(), messages: [] }).success).toBe(false);
    expect(
      chatRequestSchema.safeParse({
        sessionId: uuid(),
        subject: "historia",
        messages: [{ id: uuid(), role: "user", content: "hola" }],
      }).success,
    ).toBe(false);
  });
});

describe("env", () => {
  afterEach(() => resetEnvCache());

  it("aplica valores por defecto y elige mock sin claves", () => {
    resetEnvCache();
    const env = getEnv();
    expect(env.ANTHROPIC_MODEL).toBe("claude-fable-5-1");
    expect(env.AI_WINDOW_PAIRS).toBe(6);
    expect(env.AUTH_REQUIRED).toBe(false);
    expect(resolveProvider({ ...env, ANTHROPIC_API_KEY: undefined, OPENROUTER_API_KEY: undefined, AI_PROVIDER: undefined })).toBe("mock");
  });

  it("deduce el proveedor por las claves presentes", () => {
    const base = getEnv();
    expect(resolveProvider({ ...base, AI_PROVIDER: undefined, ANTHROPIC_API_KEY: "k" })).toBe("anthropic");
    expect(
      resolveProvider({ ...base, AI_PROVIDER: undefined, ANTHROPIC_API_KEY: undefined, OPENROUTER_API_KEY: "k" }),
    ).toBe("openrouter");
    expect(resolveProvider({ ...base, AI_PROVIDER: "mock", ANTHROPIC_API_KEY: "k" })).toBe("mock");
  });
});

describe("MemoryRateLimiter", () => {
  it("parsea ventanas", () => {
    expect(parseWindow("10 m")).toBe(600_000);
    expect(parseWindow("30s")).toBe(30_000);
    expect(() => parseWindow("pronto")).toThrow();
  });

  it("permite N peticiones por ventana y luego bloquea hasta que expira", async () => {
    let now = 1_000;
    const limiter = new MemoryRateLimiter(2, 1_000, () => now);
    expect((await limiter.check("a")).ok).toBe(true);
    expect((await limiter.check("a")).ok).toBe(true);
    const blocked = await limiter.check("a");
    expect(blocked.ok).toBe(false);
    expect(blocked.resetAt).toBe(2_000);
    expect((await limiter.check("b")).ok).toBe(true);
    now = 2_001;
    expect((await limiter.check("a")).ok).toBe(true);
  });
});
