import type { RateLimiter, RateLimitResult } from "@/lib/contracts/ratelimit";

export type WindowUnit = "ms" | "s" | "m" | "h" | "d";

const UNIT_MS: Record<WindowUnit, number> = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

/** Descompone "10 m", "10m" o " 30 S " en `{ value: 10, unit: "m" }`. Lanza si el formato no es válido o el valor es 0. */
export function parseWindowParts(window: string): { value: number; unit: WindowUnit } {
  const match = /^\s*(\d+)\s*(ms|s|m|h|d)\s*$/i.exec(window);
  const value = match ? Number(match[1]) : 0;
  if (!match || value <= 0) throw new Error(`RATE_LIMIT_WINDOW inválida: "${window}"`);
  return { value, unit: match[2].toLowerCase() as WindowUnit };
}

/** Convierte "10 m", "10m", "30 s", "1 h" en milisegundos. */
export function parseWindow(window: string): number {
  const { value, unit } = parseWindowParts(window);
  return value * UNIT_MS[unit];
}

/**
 * Ventana deslizante en memoria del proceso. Fallback cuando no hay Upstash.
 * No sobrevive a reinicios ni se comparte entre instancias: solo para dev, tests y CI.
 */
export class MemoryRateLimiter implements RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  async check(key: string): Promise<RateLimitResult> {
    const t = this.now();
    const since = t - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((ts) => ts > since);
    if (recent.length >= this.max) {
      this.hits.set(key, recent);
      return { ok: false, remaining: 0, resetAt: recent[0] + this.windowMs };
    }
    recent.push(t);
    this.hits.set(key, recent);
    return { ok: true, remaining: this.max - recent.length, resetAt: recent[0] + this.windowMs };
  }
}
