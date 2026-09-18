import { describe, it, expect } from "vitest";
import { chatErrorResponse } from "@/lib/http/errors";

describe("chatErrorResponse", () => {
  it("retorna [body, config] para usar con NextResponse.json(...)", () => {
    const [body, config] = chatErrorResponse("invalid_request", "Mensaje", 400);
    expect(body).toEqual({
      error: "invalid_request",
      message: "Mensaje",
    });
    expect(config).toEqual({ status: 400 });
  });

  it("añade retryAfter si se proporciona", () => {
    const [body, config] = chatErrorResponse("rate_limited", "Espera", 429, {
      retryAfter: 60,
    });
    expect(body.retryAfter).toBe(60);
    expect(config.headers?.["Retry-After"]).toBe("60");
  });

  it("añade issues si se proporciona", () => {
    const issues = [{ code: "too_long" }];
    const [body] = chatErrorResponse("invalid_request", "Msg", 400, { issues });
    expect(body.issues).toEqual(issues);
  });

  it("retorna el código y mensaje exacto", () => {
    const [body] = chatErrorResponse("budget_exhausted", "Presupuesto agotado", 503);
    expect(body.error).toBe("budget_exhausted");
    expect(body.message).toBe("Presupuesto agotado");
  });

  it("no añade header Retry-After si retryAfter no se proporciona", () => {
    const [, config] = chatErrorResponse("invalid_request", "Msg", 400);
    expect(config.headers).toBeUndefined();
  });

  it("upstream_error sin extras", () => {
    const [body, config] = chatErrorResponse(
      "upstream_error",
      "Error al procesar tu solicitud.",
      500
    );
    expect(body).toEqual({
      error: "upstream_error",
      message: "Error al procesar tu solicitud.",
    });
    expect(config.status).toBe(500);
  });
});
