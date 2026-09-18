import { describe, it, expect, vi } from "vitest";
import { createChatLogEvent, logChatEvent, type ChatLogEvent } from "@/lib/ai/log";
import type { TutorReplyDone } from "@/lib/contracts/ai";

describe("lib/ai/log", () => {
  describe("createChatLogEvent", () => {
    it("crea un evento de log bien formado sin contenido de mensajes", () => {
      const sessionId = "550e8400-e29b-41d4-a716-446655440000";
      const provider = "anthropic" as const;
      const done: TutorReplyDone = {
        usage: {
          inputTokens: 123,
          outputTokens: 456,
          cacheReadTokens: 10,
          cacheWriteTokens: 20,
        },
        model: "claude-fable-5-1",
        stopReason: "end_turn",
        latencyMs: 1500,
        ttfbMs: 150,
      };

      const event = createChatLogEvent(sessionId, provider, done);

      expect(event).toEqual({
        event: "chat",
        sessionId,
        provider,
        model: "claude-fable-5-1",
        inputTokens: 123,
        outputTokens: 456,
        cacheReadTokens: 10,
        cacheWriteTokens: 20,
        latencyMs: 1500,
        ttfbMs: 150,
        stopReason: "end_turn",
      });
    });
  });

  describe("logChatEvent", () => {
    it("emite exactamente una línea JSON sin PII", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const event: ChatLogEvent = {
        event: "chat",
        sessionId: "550e8400-e29b-41d4-a716-446655440000",
        provider: "mock",
        model: "eli-mock",
        inputTokens: 50,
        outputTokens: 100,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        latencyMs: 500,
        ttfbMs: 50,
        stopReason: "end_turn",
      };

      logChatEvent(event);

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const logged = consoleSpy.mock.calls[0][0];
      expect(typeof logged).toBe("string");

      // Verificar que es JSON válido
      const parsed = JSON.parse(logged);
      expect(parsed).toEqual(event);

      // Verificar que NO contiene contenido de mensajes (no debe haber ciertos patrones)
      expect(logged).not.toContain("content");
      expect(logged).not.toContain("messages");
      expect(logged).not.toContain("role");

      consoleSpy.mockRestore();
    });

    it("serializa todos los campos numéricos correctamente", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const event: ChatLogEvent = {
        event: "chat",
        sessionId: "550e8400-e29b-41d4-a716-446655440000",
        provider: "anthropic",
        model: "claude-fable-5-1",
        inputTokens: 1000,
        outputTokens: 2000,
        cacheReadTokens: 500,
        cacheWriteTokens: 100,
        latencyMs: 5000,
        ttfbMs: 500,
        stopReason: "max_tokens",
      };

      logChatEvent(event);

      const logged = consoleSpy.mock.calls[0][0];
      const parsed = JSON.parse(logged) as ChatLogEvent;

      expect(parsed.inputTokens).toBe(1000);
      expect(parsed.outputTokens).toBe(2000);
      expect(parsed.cacheReadTokens).toBe(500);
      expect(parsed.cacheWriteTokens).toBe(100);
      expect(parsed.latencyMs).toBe(5000);
      expect(parsed.ttfbMs).toBe(500);

      consoleSpy.mockRestore();
    });
  });
});
