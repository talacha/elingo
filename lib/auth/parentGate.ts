import { randomBytes } from "node:crypto";
import { createRedisFromEnv, hasRedisCredentials } from "@/lib/ratelimit/upstash";
import { getEnv } from "@/lib/env";

/**
 * Token de corta duración que desbloquea /reportes tras verificar la palabra segura (T-parent-gate).
 * Redis (Upstash) cuando hay credenciales, para que sobreviva entre instancias de Vercel; mapa en
 * memoria del proceso si no -- se pierde al reiniciar, igual que el resto de fallbacks locales.
 */
export const PARENT_GATE_COOKIE = "eli_parent_gate";
const PREFIX = "eli:parentgate:";
const TTL_SECONDS = 30 * 60; // 30 min: suficiente para leer reportes sin dejar la puerta abierta

const memoryStore = new Map<string, { userId: string; expiresAt: number }>();

function pruneMemoryStore() {
  const now = Date.now();
  for (const [token, entry] of memoryStore) {
    if (entry.expiresAt <= now) memoryStore.delete(token);
  }
}

/** Crea un token opaco de un solo propósito para este userId y lo guarda con TTL. */
export async function createGateToken(userId: string): Promise<string> {
  const token = randomBytes(24).toString("hex");
  const env = getEnv();

  if (hasRedisCredentials(env)) {
    const redis = createRedisFromEnv();
    await redis.set(PREFIX + token, userId, { ex: TTL_SECONDS });
  } else {
    pruneMemoryStore();
    memoryStore.set(token, { userId, expiresAt: Date.now() + TTL_SECONDS * 1000 });
  }

  return token;
}

/** Devuelve el userId si el token es válido y no ha caducado; null en cualquier otro caso. */
export async function verifyGateToken(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const env = getEnv();

  if (hasRedisCredentials(env)) {
    const redis = createRedisFromEnv();
    const userId = await redis.get<string>(PREFIX + token);
    return userId ?? null;
  }

  pruneMemoryStore();
  const entry = memoryStore.get(token);
  return entry ? entry.userId : null;
}

export const PARENT_GATE_TTL_SECONDS = TTL_SECONDS;
