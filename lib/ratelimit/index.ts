import type { RateLimiter, RateLimitResult } from "@/lib/contracts/ratelimit";
import { getEnv } from "@/lib/env";
import { MemoryRateLimiter, parseWindow } from "./memory";
import { createRedisFromEnv, hasRedisCredentials, UpstashRateLimiter } from "./upstash";

export { MemoryRateLimiter, parseWindow, parseWindowParts } from "./memory";
export {
  createRedisFromEnv,
  hasRedisCredentials,
  RATE_LIMIT_PREFIX,
  toDuration,
  UpstashRateLimiter,
} from "./upstash";

let limiter: RateLimiter | null = null;
let memory: MemoryRateLimiter | null = null;
let warned = false;

function getMemoryLimiter(): MemoryRateLimiter {
  if (!memory) {
    const env = getEnv();
    memory = new MemoryRateLimiter(env.RATE_LIMIT_MAX, parseWindow(env.RATE_LIMIT_WINDOW));
  }
  return memory;
}

/**
 * `UpstashRateLimiter` con credenciales de Upstash (tasks.md 6.3 y 6.6), `MemoryRateLimiter` sin ellas.
 * Una instancia por proceso; `RATE_LIMIT_MAX` peticiones por clave y ventana `RATE_LIMIT_WINDOW`.
 */
export function getRateLimiter(): RateLimiter {
  if (!limiter) {
    const env = getEnv();
    limiter = hasRedisCredentials(env)
      ? new UpstashRateLimiter(createRedisFromEnv(), env.RATE_LIMIT_MAX, env.RATE_LIMIT_WINDOW)
      : getMemoryLimiter();
  }
  return limiter;
}

/** Solo para tests: descarta las instancias para releer el entorno. */
export function resetRateLimiter(): void {
  limiter = null;
  memory = null;
  warned = false;
}

/**
 * Clave: userId ?? anonId ?? ip. Si Upstash falla (red, credenciales), degrada a la ventana en memoria
 * del proceso en vez de dejar pasar todo: sigue habiendo un tope por instancia. Avisa una vez por proceso.
 */
export async function checkRateLimit(key: string): Promise<RateLimitResult> {
  const active = getRateLimiter();
  try {
    return await active.check(key);
  } catch (error) {
    if (active instanceof MemoryRateLimiter) throw error;
    if (!warned) {
      warned = true;
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`[ratelimit] Upstash no disponible, usando la ventana en memoria: ${reason}`);
    }
    return getMemoryLimiter().check(key);
  }
}
