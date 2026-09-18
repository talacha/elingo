import { describe, it, expect, afterEach } from "vitest";
import { GET } from "@/app/api/health/route";
import { resetEnvCache } from "@/lib/env";
import { resetRateLimiter } from "@/lib/ratelimit";
import { resetRepo } from "@/lib/db";

afterEach(() => {
  resetEnvCache();
  resetRateLimiter();
  resetRepo();
});

describe("GET /api/health", () => {
  it("retorna { ok: true, provider, model, db, redis, version }", async () => {
    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty("ok", true);
    expect(body).toHaveProperty("provider");
    expect(body).toHaveProperty("model");
    expect(body).toHaveProperty("db");
    expect(body).toHaveProperty("redis");
    expect(body).toHaveProperty("version");
  });

  it("provider es uno de anthropic, openrouter, mock", async () => {
    const response = await GET();
    const body = await response.json();
    expect(["anthropic", "openrouter", "mock"]).toContain(body.provider);
  });

  it("db es neon o memory", async () => {
    const response = await GET();
    const body = await response.json();
    expect(["neon", "memory"]).toContain(body.db);
  });

  it("redis es boolean", async () => {
    const response = await GET();
    const body = await response.json();
    expect(typeof body.redis).toBe("boolean");
  });

  it("model es un string no vacío", async () => {
    const response = await GET();
    const body = await response.json();
    expect(typeof body.model).toBe("string");
    expect(body.model.length).toBeGreaterThan(0);
  });

  it("version es un string", async () => {
    const response = await GET();
    const body = await response.json();
    expect(typeof body.version).toBe("string");
  });

  it("sin credenciales redis, redis es false", async () => {
    // En tests sin env vars de Redis, debería ser false
    const response = await GET();
    const body = await response.json();
    // Si no hay credenciales de Redis en el entorno de test
    // redis debería ser false
    if (!process.env.UPSTASH_REDIS_REST_URL && !process.env.KV_REST_API_URL) {
      expect(body.redis).toBe(false);
    }
  });
});
