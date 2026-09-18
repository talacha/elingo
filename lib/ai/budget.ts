import { Redis } from "@upstash/redis";
import type { Env } from "@/lib/env";
import { getEnv } from "@/lib/env";
import { hasRedisCredentials, createRedisFromEnv } from "@/lib/ratelimit";

const BUDGET_PREFIX = "eli:budget";

/** En memoria: clave es la fecha UTC (YYYY-MM-DD). */
const memoryBudget = new Map<string, number>();

interface BudgetChecker {
  increment(tokens: number): Promise<number>;
  checkLimit(): Promise<boolean>;
}

/** Cuenta diaria de tokens usando Redis (Upstash) cuando está disponible. */
class UpstashBudgetChecker implements BudgetChecker {
  private readonly redis: Redis;
  private readonly dailyLimit: number;

  constructor(redis: Redis, dailyLimit: number) {
    this.redis = redis;
    this.dailyLimit = dailyLimit;
  }

  private getKey(): string {
    const now = new Date();
    const date = now.toISOString().split("T")[0]; // YYYY-MM-DD (UTC)
    return `${BUDGET_PREFIX}:${date}`;
  }

  async increment(tokens: number): Promise<number> {
    try {
      const key = this.getKey();
      const newTotal = await this.redis.incrby(key, tokens);
      // Set expiry to 2 days so we don't have stale keys
      await this.redis.expire(key, 2 * 24 * 60 * 60);
      return newTotal;
    } catch {
      // Fallback to memory on Redis error
      return this.memoryIncrement(tokens);
    }
  }

  async checkLimit(): Promise<boolean> {
    try {
      const key = this.getKey();
      const current = (await this.redis.get<number>(key)) ?? 0;
      return current < this.dailyLimit;
    } catch {
      // Fallback to memory on Redis error
      return this.memoryCheck();
    }
  }

  private memoryIncrement(tokens: number): number {
    const key = this.getKey();
    const current = memoryBudget.get(key) ?? 0;
    const newTotal = current + tokens;
    memoryBudget.set(key, newTotal);
    return newTotal;
  }

  private memoryCheck(): boolean {
    const key = this.getKey();
    const current = memoryBudget.get(key) ?? 0;
    return current < this.dailyLimit;
  }
}

/** Cuenta diaria de tokens usando solo memoria del proceso. */
class MemoryBudgetChecker implements BudgetChecker {
  private readonly dailyLimit: number;

  constructor(dailyLimit: number) {
    this.dailyLimit = dailyLimit;
  }

  private getKey(): string {
    const now = new Date();
    return now.toISOString().split("T")[0]; // YYYY-MM-DD (UTC)
  }

  async increment(tokens: number): Promise<number> {
    const key = this.getKey();
    const current = memoryBudget.get(key) ?? 0;
    const newTotal = current + tokens;
    memoryBudget.set(key, newTotal);
    return newTotal;
  }

  async checkLimit(): Promise<boolean> {
    const key = this.getKey();
    const current = memoryBudget.get(key) ?? 0;
    return current < this.dailyLimit;
  }
}

let checker: BudgetChecker | null = null;

function getBudgetChecker(env: Env = getEnv()): BudgetChecker {
  if (!checker) {
    const dailyLimit = env.DAILY_TOKEN_BUDGET;
    if (hasRedisCredentials(env)) {
      const redis = createRedisFromEnv();
      checker = new UpstashBudgetChecker(redis, dailyLimit);
    } else {
      checker = new MemoryBudgetChecker(dailyLimit);
    }
  }
  return checker;
}

/**
 * Incrementa el contador diario de tokens y retorna el total actual.
 * Útil para usar tras `done` del AI provider para registrar el gasto.
 */
export async function incrementBudget(tokens: number): Promise<number> {
  return getBudgetChecker().increment(tokens);
}

/**
 * Retorna true si el presupuesto diario aún tiene espacio, false si está agotado.
 * Llamar ANTES de enviar la petición al proveedor de IA para bloquear si es necesario.
 */
export async function checkBudget(): Promise<boolean> {
  return getBudgetChecker().checkLimit();
}

/** Solo para tests: descarta la instancia para releer el entorno. */
export function resetBudgetChecker(): void {
  checker = null;
}

/** Solo para tests: limpia la memoria. */
export function clearMemoryBudget(): void {
  memoryBudget.clear();
}
