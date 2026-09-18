import type { ChatError, ChatErrorCode } from "@/lib/contracts/chat";

export interface ChatErrorResponseOptions {
  retryAfter?: number;
  issues?: unknown;
}

/**
 * Crea una respuesta JSON consistente de ChatError junto con status e headers.
 * Uso: `return NextResponse.json(...chatErrorResponse(...))`.
 */
export function chatErrorResponse(
  code: ChatErrorCode,
  message: string,
  status: number,
  extra?: ChatErrorResponseOptions,
): [ChatError, { status: number; headers?: Record<string, string> }] {
  const body: ChatError = { error: code, message, ...extra };
  const headers: Record<string, string> = {};

  if (extra?.retryAfter) {
    headers["Retry-After"] = String(extra.retryAfter);
  }

  return [body, { status, ...(Object.keys(headers).length > 0 ? { headers } : {}) }];
}
