import { createRedisFromEnv, hasRedisCredentials } from "@/lib/ratelimit";
import { getEnv } from "@/lib/env";

/**
 * Token de desbloqueo de /parents (T-061): tras verificar la palabra segura, se emite un token
 * opaco ligado al userId con TTL corto. Mismo patrón que lib/ratelimit y lib/ai/budget: Redis
 * (Upstash) cuando hay credenciales, memoria del proceso si no — nunca bloquea ni lanza.
 */
const PREFIX = "eli:parent-unlock";
const TTL_SECONDS = 4 * 60 * 60; // 4 horas: suficiente para una sesión de ajustes, no una sesión eterna.

const memoryStore = new Map<string, { userId: string; expiresAt: number }>();

function pruneExpired(): void {
  const now = Date.now();
  for (const [token, entry] of memoryStore) {
    if (entry.expiresAt <= now) memoryStore.delete(token);
  }
}

export async function createUnlockToken(userId: string): Promise<string> {
  const token = crypto.randomUUID();
  const env = getEnv();
  if (hasRedisCredentials(env)) {
    try {
      await createRedisFromEnv().set(`${PREFIX}:${token}`, userId, { ex: TTL_SECONDS });
      return token;
    } catch {
      // Redis no disponible: cae a memoria en vez de dejar sin desbloquear.
    }
  }
  pruneExpired();
  memoryStore.set(token, { userId, expiresAt: Date.now() + TTL_SECONDS * 1000 });
  return token;
}

/** true si `token` desbloquea /parents para exactamente `userId` (nunca para otra cuenta). */
export async function verifyUnlockToken(token: string | undefined, userId: string): Promise<boolean> {
  if (!token) return false;
  const env = getEnv();
  if (hasRedisCredentials(env)) {
    try {
      const stored = await createRedisFromEnv().get<string>(`${PREFIX}:${token}`);
      if (stored !== null) return stored === userId;
    } catch {
      // sigue comprobando en memoria
    }
  }
  pruneExpired();
  return memoryStore.get(token)?.userId === userId;
}

/** Solo para tests. */
export function resetParentUnlockMemory(): void {
  memoryStore.clear();
}
