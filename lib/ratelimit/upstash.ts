import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { RateLimiter, RateLimitResult } from "@/lib/contracts/ratelimit";
import type { Env } from "@/lib/env";
import { parseWindowParts } from "./memory";

/** Prefijo de todas las claves en Redis: `eli:rl:<clave>[:<ventana>]`. */
export const RATE_LIMIT_PREFIX = "eli:rl";

/** Espera máxima a Redis por comprobación; pasado el plazo la petición pasa (`reason: "timeout"`). */
const REDIS_TIMEOUT_MS = 2_000;

type Duration = Parameters<typeof Ratelimit.slidingWindow>[1];

/** Normaliza RATE_LIMIT_WINDOW ("10m", " 10 M ") al formato `${n} ${unidad}` que exige @upstash/ratelimit. */
export function toDuration(window: string): Duration {
  const { value, unit } = parseWindowParts(window);
  return `${value} ${unit}`;
}

/**
 * Hay credenciales de Upstash si está completo el par del contrato (UPSTASH_REDIS_REST_*) o el par que
 * instala «Upstash for Redis» del Marketplace de Vercel (KV_REST_API_*). `Redis.fromEnv()` lee ambos.
 */
export function hasRedisCredentials(env: Env): boolean {
  return Boolean(
    (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) ||
      (env.KV_REST_API_URL && env.KV_REST_API_TOKEN),
  );
}

/** Cliente REST de Upstash desde el entorno, con reintentos cortos: el rate limit no debe frenar el chat. */
export function createRedisFromEnv(): Redis {
  return Redis.fromEnv({ retry: { retries: 2, backoff: (attempt) => 100 * attempt } });
}

/** Ventana deslizante compartida entre instancias (Vercel) sobre Upstash Redis. */
export class UpstashRateLimiter implements RateLimiter {
  private readonly limiter: Ratelimit;

  constructor(redis: Redis, max: number, window: string, prefix: string = RATE_LIMIT_PREFIX) {
    this.limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(max, toDuration(window)),
      prefix,
      analytics: false,
      timeout: REDIS_TIMEOUT_MS,
    });
  }

  async check(key: string): Promise<RateLimitResult> {
    const { success, remaining, reset } = await this.limiter.limit(key);
    return { ok: success, remaining, resetAt: reset };
  }
}
