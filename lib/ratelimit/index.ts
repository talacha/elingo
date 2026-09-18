import type { RateLimitResult } from "@/lib/contracts/ratelimit";
import { getEnv } from "@/lib/env";
import { MemoryRateLimiter, parseWindow } from "./memory";

// T-001: solo el fallback en memoria. T-021 añade Upstash cuando hay credenciales.
let limiter: MemoryRateLimiter | null = null;

function getLimiter(): MemoryRateLimiter {
  if (!limiter) {
    const env = getEnv();
    limiter = new MemoryRateLimiter(env.RATE_LIMIT_MAX, parseWindow(env.RATE_LIMIT_WINDOW));
  }
  return limiter;
}

/** Clave: userId ?? anonId ?? ip. */
export async function checkRateLimit(key: string): Promise<RateLimitResult> {
  return getLimiter().check(key);
}
