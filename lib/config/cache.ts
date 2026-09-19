import type { Redis } from "@upstash/redis";
import { getEnv } from "@/lib/env";
import { createRedisFromEnv, hasRedisCredentials } from "@/lib/ratelimit";

/**
 * Caché de lectura de la configuración, en tres niveles:
 *   1. memoria del proceso (`localTtlMs`, corta: acota cuánto tarda otra instancia en ver un cambio),
 *   2. Redis (Upstash) compartido entre instancias (`redisTtlSeconds`),
 *   3. Postgres, que es la fuente de verdad (`loader`).
 * Las escrituras llaman a `invalidate`, que borra los dos primeros niveles de esta instancia y el de
 * Redis (las demás instancias se enteran en cuanto caduca su nivel 1). Sin credenciales de Redis solo
 * hay memoria. Un fallo de Redis nunca rompe una lectura: se salta ese nivel.
 */

export const CONFIG_CACHE_PREFIX = "eli:cfg";

export interface CacheOptions {
  localTtlMs?: number;
  redisTtlSeconds?: number;
}

const DEFAULT_LOCAL_TTL_MS = 5_000;
const DEFAULT_REDIS_TTL_SECONDS = 300;

const local = new Map<string, { value: unknown; expiresAt: number }>();
let redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redis === undefined) {
    const env = getEnv();
    redis = hasRedisCredentials(env) ? createRedisFromEnv() : null;
  }
  return redis;
}

export async function readThrough<T>(
  key: string,
  loader: () => Promise<T>,
  options: CacheOptions = {},
): Promise<T> {
  const localTtlMs = options.localTtlMs ?? DEFAULT_LOCAL_TTL_MS;
  const redisTtlSeconds = options.redisTtlSeconds ?? DEFAULT_REDIS_TTL_SECONDS;

  const hit = local.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;

  const client = getRedis();
  let value: T | undefined;
  if (client) {
    try {
      const cached = await client.get<T>(key);
      if (cached !== null && cached !== undefined) value = cached;
    } catch {
      // Redis caído: se lee de Postgres.
    }
  }

  if (value === undefined) {
    value = await loader();
    if (client) {
      try {
        await client.set(key, value, { ex: redisTtlSeconds });
      } catch {
        // No cachear no es un error.
      }
    }
  }

  local.set(key, { value, expiresAt: Date.now() + localTtlMs });
  return value;
}

/** Descarta las claves en memoria y en Redis. Nunca lanza. */
export async function invalidate(...keys: string[]): Promise<void> {
  for (const key of keys) local.delete(key);
  const client = getRedis();
  if (!client || keys.length === 0) return;
  try {
    await client.del(...keys);
  } catch {
    // Sin Redis el nivel 2 caduca solo por TTL.
  }
}

/** Solo para tests: vacía la memoria y suelta el cliente de Redis para releer el entorno. */
export function resetConfigCache(): void {
  local.clear();
  redis = undefined;
}
