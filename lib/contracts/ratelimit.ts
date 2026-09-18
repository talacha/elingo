/** Contrato del rate limit. Fuente de verdad: tasks.md, sección 6.3. */
export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  /** Epoch en milisegundos en el que se reinicia la ventana. */
  resetAt: number;
}

export interface RateLimiter {
  /** Clave: userId ?? anonId ?? ip. */
  check(key: string): Promise<RateLimitResult>;
}
