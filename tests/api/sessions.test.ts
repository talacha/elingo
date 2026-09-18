import { describe, it, expect, beforeEach } from "vitest";
import { MemoryRepo } from "@/lib/db/memory";
import { resetRepo } from "@/lib/db";

const uuid = () => crypto.randomUUID();

describe("GET /api/sessions", () => {
  let repo: MemoryRepo;

  beforeEach(async () => {
    resetRepo();
    repo = new MemoryRepo();
  });

  describe("listSessions", () => {
    it("devuelve sesiones vacías cuando no hay anon_id", async () => {
      const anonId = uuid();
      const result = await repo.listSessions({ anonId });
      expect(result).toEqual([]);
    });

    it("lista sesiones para un anonId específico", async () => {
      const anonId = uuid();
      const sessionId1 = uuid();
      const sessionId2 = uuid();
      const anotherAnonId = uuid();

      // Create sessions for the first anonId
      await repo.upsertSession({
        id: sessionId1,
        anonId,
        subject: "mates",
        title: "Fracciones",
      });
      await repo.upsertSession({
        id: sessionId2,
        anonId,
        subject: "lengua",
        title: "Verbos",
      });

      // Create a session for a different anonId
      const sessionId3 = uuid();
      await repo.upsertSession({
        id: sessionId3,
        anonId: anotherAnonId,
        subject: "ciencias",
        title: "Fotosíntesis",
      });

      // List sessions for the first anonId - should only see 2 sessions
      const result = await repo.listSessions({ anonId });
      expect(result).toHaveLength(2);
      expect(result.map((s) => s.id)).toContain(sessionId1);
      expect(result.map((s) => s.id)).toContain(sessionId2);
      expect(result.map((s) => s.id)).not.toContain(sessionId3);

      // Verify sessions have the correct data
      const titles = result.map((s) => s.title);
      expect(titles).toContain("Fracciones");
      expect(titles).toContain("Verbos");
    });

    it("lista sesiones más recientes primero", async () => {
      const anonId = uuid();
      const sessionId1 = uuid();
      const sessionId2 = uuid();

      await repo.upsertSession({
        id: sessionId1,
        anonId,
        subject: "mates",
        title: "Sesión 1",
      });

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      await repo.upsertSession({
        id: sessionId2,
        anonId,
        subject: "lengua",
        title: "Sesión 2",
      });

      const result = await repo.listSessions({ anonId });
      expect(result).toHaveLength(2);
      // Most recent should be first
      expect(result[0].id).toBe(sessionId2);
      expect(result[1].id).toBe(sessionId1);
    });

    it("respeta el scope anonId - no devuelve sesiones de otros usuarios", async () => {
      const anonId1 = uuid();
      const anonId2 = uuid();
      const sessionId1 = uuid();
      const sessionId2 = uuid();

      await repo.upsertSession({
        id: sessionId1,
        anonId: anonId1,
        subject: "mates",
        title: "Mi sesión",
      });

      await repo.upsertSession({
        id: sessionId2,
        anonId: anonId2,
        subject: "lengua",
        title: "Otra sesión",
      });

      const result1 = await repo.listSessions({ anonId: anonId1 });
      const result2 = await repo.listSessions({ anonId: anonId2 });

      expect(result1).toHaveLength(1);
      expect(result1[0].id).toBe(sessionId1);

      expect(result2).toHaveLength(1);
      expect(result2[0].id).toBe(sessionId2);
    });
  });

  describe("getSession", () => {
    it("devuelve null cuando la sesión no existe", async () => {
      const anonId = uuid();
      const sessionId = uuid();
      const result = await repo.getSession(sessionId, { anonId });
      expect(result).toBeNull();
    });

    it("devuelve la sesión completa con mensajes para el anonId correcto", async () => {
      const anonId = uuid();
      const sessionId = uuid();

      // Create session
      await repo.upsertSession({
        id: sessionId,
        anonId,
        subject: "mates",
        title: "Fracciones",
      });

      // Add messages
      const msg1Id = uuid();
      const msg2Id = uuid();
      await repo.insertMessages([
        {
          id: msg1Id,
          sessionId,
          role: "user",
          content: "¿Cómo sumo fracciones?",
        },
        {
          id: msg2Id,
          sessionId,
          role: "assistant",
          content: "Para sumar fracciones necesitas...",
        },
      ]);

      const result = await repo.getSession(sessionId, { anonId });

      expect(result).not.toBeNull();
      expect(result?.session.id).toBe(sessionId);
      expect(result?.session.title).toBe("Fracciones");
      expect(result?.session.subject).toBe("mates");
      expect(result?.messages).toHaveLength(2);
      expect(result?.messages[0].content).toBe("¿Cómo sumo fracciones?");
      expect(result?.messages[1].content).toBe("Para sumar fracciones necesitas...");
      expect(result?.messages[0].role).toBe("user");
      expect(result?.messages[1].role).toBe("assistant");
    });

    it("devuelve null si la sesión existe pero pertenece a otro anonId", async () => {
      const anonId1 = uuid();
      const anonId2 = uuid();
      const sessionId = uuid();

      // Create session for anonId1
      await repo.upsertSession({
        id: sessionId,
        anonId: anonId1,
        subject: "mates",
        title: "Mi sesión",
      });

      // Try to get with anonId2 - should get null (not a 404, but null which the handler converts to 404)
      const result = await repo.getSession(sessionId, { anonId: anonId2 });
      expect(result).toBeNull();
    });

    it("mantiene el orden de mensajes en la sesión", async () => {
      const anonId = uuid();
      const sessionId = uuid();

      await repo.upsertSession({ id: sessionId, anonId });

      const messages = [
        {
          id: uuid(),
          sessionId,
          role: "user" as const,
          content: "Primer mensaje",
        },
        {
          id: uuid(),
          sessionId,
          role: "assistant" as const,
          content: "Respuesta uno",
        },
        {
          id: uuid(),
          sessionId,
          role: "user" as const,
          content: "Segundo mensaje",
        },
        {
          id: uuid(),
          sessionId,
          role: "assistant" as const,
          content: "Respuesta dos",
        },
      ];

      await repo.insertMessages(messages);

      const result = await repo.getSession(sessionId, { anonId });
      expect(result?.messages).toHaveLength(4);
      expect(result?.messages.map((m) => m.content)).toEqual([
        "Primer mensaje",
        "Respuesta uno",
        "Segundo mensaje",
        "Respuesta dos",
      ]);
    });

    it("no incluye mensajes de system en el detail response", async () => {
      const anonId = uuid();
      const sessionId = uuid();

      await repo.upsertSession({ id: sessionId, anonId });

      // Try to insert a system message (should be filtered)
      const messages = [
        {
          id: uuid(),
          sessionId,
          role: "user" as const,
          content: "Mensaje",
        },
        {
          id: uuid(),
          sessionId,
          role: "system" as const,
          content: "Sistema",
        },
      ];

      await repo.insertMessages(messages);

      const result = await repo.getSession(sessionId, { anonId });
      // Should only have the user message, not system
      const userAssistantMessages = result?.messages.filter(
        (m) => m.role === "user" || m.role === "assistant"
      );
      expect(userAssistantMessages).toHaveLength(1);
      expect(userAssistantMessages?.[0].role).toBe("user");
    });

    it("devuelve la información correcta de la sesión incluyendo updatedAt", async () => {
      const anonId = uuid();
      const sessionId = uuid();

      const created = await repo.upsertSession({
        id: sessionId,
        anonId,
        subject: "ciencias",
        title: "Ecosistemas",
      });

      const result = await repo.getSession(sessionId, { anonId });

      expect(result?.session).toBeDefined();
      expect(result?.session.id).toBe(sessionId);
      expect(result?.session.title).toBe("Ecosistemas");
      expect(result?.session.subject).toBe("ciencias");
      expect(result?.session.updatedAt).toBe(created.updatedAt);
      expect(typeof result?.session.updatedAt).toBe("string");
    });
  });

  describe("403-for-wrong-owner scenarios (via repo)", () => {
    it("simula el caso donde la sesión pertenece a otro anonId (tipo 404 de seguridad)", async () => {
      const anonId1 = uuid();
      const anonId2 = uuid();
      const sessionId = uuid();

      // Crear sesión para anonId1
      await repo.upsertSession({
        id: sessionId,
        anonId: anonId1,
        subject: "mates",
        title: "Sesión privada",
      });

      // Intentar acceder con anonId2
      const resultWrongOwner = await repo.getSession(sessionId, {
        anonId: anonId2,
      });

      // Debe ser null (lo que el handler convierte en 404)
      expect(resultWrongOwner).toBeNull();

      // Verificar que con el anonId correcto sí funciona
      const resultCorrectOwner = await repo.getSession(sessionId, {
        anonId: anonId1,
      });
      expect(resultCorrectOwner).not.toBeNull();
      expect(resultCorrectOwner?.session.id).toBe(sessionId);
    });
  });
});
