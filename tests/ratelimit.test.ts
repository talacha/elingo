import { afterEach, describe, expect, it, vi } from "vitest";
import { getEnv, resetEnvCache } from "@/lib/env";
import {
  checkRateLimit,
  createRedisFromEnv,
  getRateLimiter,
  hasRedisCredentials,
  MemoryRateLimiter,
  parseWindow,
  parseWindowParts,
  RATE_LIMIT_PREFIX,
  resetRateLimiter,
  toDuration,
  UpstashRateLimiter,
} from "@/lib/ratelimit";

const ENV_KEYS = [
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
  "RATE_LIMIT_MAX",
  "RATE_LIMIT_WINDOW",
] as const;
type EnvKey = (typeof ENV_KEYS)[number];

/** Credenciales reales presentes al arrancar (por ejemplo, tras `vercel env pull .env.local`). */
const LIVE = Boolean(
  (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) ||
    (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN),
);
const saved: Partial<Record<EnvKey, string>> = {};
for (const key of ENV_KEYS) saved[key] = process.env[key];

function apply(values: Partial<Record<EnvKey, string>>) {
  for (const key of ENV_KEYS) {
    const value = values[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  resetEnvCache();
  resetRateLimiter();
}

afterEach(() => {
  apply(saved);
  vi.restoreAllMocks();
});

describe("ventana de rate limit", () => {
  it("parseWindow y parseWindowParts aceptan unidades, mayúsculas y espacios", () => {
    expect(parseWindow("10 m")).toBe(600_000);
    expect(parseWindow("10m")).toBe(600_000);
    expect(parseWindow(" 30 S ")).toBe(30_000);
    expect(parseWindow("500ms")).toBe(500);
    expect(parseWindow("1 h")).toBe(3_600_000);
    expect(parseWindow("2 d")).toBe(172_800_000);
    expect(parseWindowParts("10 m")).toEqual({ value: 10, unit: "m" });
  });

  it("rechaza formatos inválidos y ventanas vacías", () => {
    for (const bad of ["pronto", "10", "m", "10 x", "", "0 m", "-5 s"]) {
      expect(() => parseWindow(bad), bad).toThrow();
    }
  });

  it("toDuration normaliza al formato de @upstash/ratelimit", () => {
    expect(toDuration("10 m")).toBe("10 m");
    expect(toDuration("10m")).toBe("10 m");
    expect(toDuration(" 30 S ")).toBe("30 s");
    expect(() => toDuration("pronto")).toThrow();
  });
});

describe("MemoryRateLimiter", () => {
  it("permite max peticiones, descuenta remaining y bloquea sin consumir", async () => {
    let now = 1_000;
    const limiter = new MemoryRateLimiter(3, 10_000, () => now);
    expect(await limiter.check("a")).toEqual({ ok: true, remaining: 2, resetAt: 11_000 });
    now = 2_000;
    expect(await limiter.check("a")).toEqual({ ok: true, remaining: 1, resetAt: 11_000 });
    expect(await limiter.check("a")).toEqual({ ok: true, remaining: 0, resetAt: 11_000 });
    expect(await limiter.check("a")).toEqual({ ok: false, remaining: 0, resetAt: 11_000 });
    // Una petición bloqueada no cuenta: resetAt no se mueve.
    now = 5_000;
    expect(await limiter.check("a")).toEqual({ ok: false, remaining: 0, resetAt: 11_000 });
  });

  it("la ventana desliza: libera hueco cuando caduca la petición más antigua", async () => {
    let now = 0;
    const limiter = new MemoryRateLimiter(2, 1_000, () => now);
    await limiter.check("a");
    now = 500;
    await limiter.check("a");
    now = 900;
    expect((await limiter.check("a")).ok).toBe(false);
    now = 1_000; // la petición de t=0 ya no cuenta
    expect(await limiter.check("a")).toEqual({ ok: true, remaining: 0, resetAt: 1_500 });
    now = 1_400;
    expect((await limiter.check("a")).ok).toBe(false);
    now = 1_500;
    expect((await limiter.check("a")).ok).toBe(true);
  });

  it("las claves son independientes", async () => {
    const limiter = new MemoryRateLimiter(1, 1_000, () => 0);
    expect((await limiter.check("a")).ok).toBe(true);
    expect((await limiter.check("b")).ok).toBe(true);
    expect((await limiter.check("a")).ok).toBe(false);
  });
});

describe("selector getRateLimiter", () => {
  const url = "https://example.upstash.io";

  it("sin credenciales usa la memoria del proceso (una instancia)", () => {
    apply({});
    expect(hasRedisCredentials(getEnv())).toBe(false);
    expect(getRateLimiter()).toBeInstanceOf(MemoryRateLimiter);
    expect(getRateLimiter()).toBe(getRateLimiter());
  });

  it("con UPSTASH_REDIS_REST_* usa Upstash", () => {
    apply({ UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: "token" });
    expect(hasRedisCredentials(getEnv())).toBe(true);
    expect(getRateLimiter()).toBeInstanceOf(UpstashRateLimiter);
  });

  it("con KV_REST_API_* (integración del Marketplace de Vercel) usa Upstash", () => {
    apply({ KV_REST_API_URL: url, KV_REST_API_TOKEN: "token" });
    expect(hasRedisCredentials(getEnv())).toBe(true);
    expect(getRateLimiter()).toBeInstanceOf(UpstashRateLimiter);
  });

  it("con un par incompleto cae a memoria", () => {
    apply({ UPSTASH_REDIS_REST_URL: url });
    expect(getRateLimiter()).toBeInstanceOf(MemoryRateLimiter);
    apply({ KV_REST_API_TOKEN: "token" });
    expect(getRateLimiter()).toBeInstanceOf(MemoryRateLimiter);
  });

  it("checkRateLimit respeta RATE_LIMIT_MAX y RATE_LIMIT_WINDOW", async () => {
    apply({ RATE_LIMIT_MAX: "2", RATE_LIMIT_WINDOW: "1 h" });
    const first = await checkRateLimit("k");
    expect(first.ok).toBe(true);
    expect(first.remaining).toBe(1);
    expect(first.resetAt).toBeGreaterThan(Date.now() + 3_500_000);
    expect((await checkRateLimit("k")).ok).toBe(true);
    expect((await checkRateLimit("k")).ok).toBe(false);
  });

  it("si Upstash falla, degrada a la ventana en memoria y avisa una sola vez", async () => {
    apply({ UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: "token", RATE_LIMIT_MAX: "2" });
    vi.spyOn(UpstashRateLimiter.prototype, "check").mockRejectedValue(new Error("boom"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect((await checkRateLimit("k")).ok).toBe(true);
    expect((await checkRateLimit("k")).ok).toBe(true);
    expect((await checkRateLimit("k")).ok).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("boom");
  });
});

describe.runIf(LIVE)("UpstashRateLimiter contra Redis real", () => {
  it("aplica la ventana deslizante bajo el prefijo eli:rl", async () => {
    const redis = createRedisFromEnv();
    const key = `test:${crypto.randomUUID()}`;
    const limiter = new UpstashRateLimiter(redis, 2, "10 s");
    const before = Date.now();
    expect(await limiter.check(key)).toMatchObject({ ok: true, remaining: 1 });
    expect(await limiter.check(key)).toMatchObject({ ok: true, remaining: 0 });
    const blocked = await limiter.check(key);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetAt).toBeGreaterThan(before);
    expect(blocked.resetAt).toBeLessThanOrEqual(before + 10_000);
    expect((await limiter.check(`${key}-otra`)).ok).toBe(true);
    const keys = await redis.keys(`${RATE_LIMIT_PREFIX}:${key}*`);
    expect(keys.length).toBeGreaterThan(0);
    await redis.del(...keys, ...(await redis.keys(`${RATE_LIMIT_PREFIX}:${key}-otra*`)));
  }, 20_000);
});
