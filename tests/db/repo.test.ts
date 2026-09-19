import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { inArray } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { getRepo, resetRepo } from "@/lib/db";
import { MemoryRepo } from "@/lib/db/memory";
import { NeonRepo } from "@/lib/db/neon";
import type { Repo } from "@/lib/db/repo";
import { chatSessions, users } from "@/lib/db/schema";
import { resetEnvCache } from "@/lib/env";

const uuid = () => crypto.randomUUID();
const anon = () => `anon-${uuid()}`;

type Cleanup = (sessionIds: string[], supabaseIds: string[]) => Promise<void>;

/** Misma batería para las dos implementaciones: la semántica debe ser idéntica. */
function repoSuite(name: string, repo: Repo, cleanup?: Cleanup) {
  describe(`repositorio ${name}`, () => {
    const sessionIds: string[] = [];
    const supabaseIds: string[] = [];
    const newSessionId = () => {
      const id = uuid();
      sessionIds.push(id);
      return id;
    };
    const newSupabaseId = () => {
      const id = `sb-${uuid()}`;
      supabaseIds.push(id);
      return id;
    };

    afterAll(async () => {
      await cleanup?.(sessionIds, supabaseIds);
    });

    it("upsertSession crea y luego refresca sin perder título ni asignatura", async () => {
      const anonId = anon();
      const id = newSessionId();
      const created = await repo.upsertSession({ id, anonId, title: "Fracciones" });
      expect(created).toMatchObject({ id, title: "Fracciones" });
      expect(created).not.toHaveProperty("subject");
      const again = await repo.upsertSession({ id, anonId });
      expect(again).toMatchObject({ id, title: "Fracciones" });
      expect(Date.parse(again.updatedAt)).toBeGreaterThanOrEqual(Date.parse(created.updatedAt));
      const retitled = await repo.upsertSession({ id, anonId, title: "Sumar fracciones" });
      expect(retitled.title).toBe("Sumar fracciones");
    });

    it("insertMessages es idempotente por id y conserva el orden del historial", async () => {
      const anonId = anon();
      const sessionId = newSessionId();
      await repo.upsertSession({ id: sessionId, anonId });
      const m1 = { id: uuid(), sessionId, role: "user" as const, content: "3/4 + 1/2" };
      const m2 = {
        id: uuid(),
        sessionId,
        role: "assistant" as const,
        content: "¿Qué datos tienes?",
        tokensIn: 10,
        tokensOut: 5,
        model: "mock",
      };
      expect(await repo.insertMessages([m1, m2])).toBe(2);
      const m3 = { id: uuid(), sessionId, role: "user" as const, content: "Los denominadores" };
      expect(await repo.insertMessages([m1, m2, m3])).toBe(1);
      expect(await repo.insertMessages([m1, m2, m3])).toBe(0);

      const detail = await repo.getSession(sessionId, { anonId });
      expect(detail?.session.id).toBe(sessionId);
      expect(detail?.messages.map((m) => m.content)).toEqual([
        "3/4 + 1/2",
        "¿Qué datos tienes?",
        "Los denominadores",
      ]);
      expect(detail?.messages[0]).toMatchObject({ id: m1.id, role: "user" });
      expect(typeof detail?.messages[0].createdAt).toBe("string");
    });

    it("insertMessages respeta createdAt si llega y no hace nada con []", async () => {
      const anonId = anon();
      const sessionId = newSessionId();
      await repo.upsertSession({ id: sessionId, anonId });
      expect(await repo.insertMessages([])).toBe(0);
      const later = {
        id: uuid(),
        sessionId,
        role: "assistant" as const,
        content: "después",
        createdAt: "2026-09-17T10:00:01.000Z",
      };
      const earlier = {
        id: uuid(),
        sessionId,
        role: "user" as const,
        content: "antes",
        createdAt: "2026-09-17T10:00:00.000Z",
      };
      await repo.insertMessages([later, earlier]);
      const detail = await repo.getSession(sessionId, { anonId });
      expect(detail?.messages.map((m) => m.content)).toEqual(["antes", "después"]);
      expect(detail?.messages[0].createdAt).toBe("2026-09-17T10:00:00.000Z");
    });

    it("insertMessages falla si la sesión no existe", async () => {
      await expect(
        repo.insertMessages([{ id: uuid(), sessionId: uuid(), role: "user", content: "x" }]),
      ).rejects.toThrow();
    });

    it("getSession oculta los mensajes system y respeta el ámbito", async () => {
      const anonId = anon();
      const sessionId = newSessionId();
      await repo.upsertSession({ id: sessionId, anonId });
      await repo.insertMessages([
        { id: uuid(), sessionId, role: "system", content: "prompt" },
        { id: uuid(), sessionId, role: "user", content: "hola" },
      ]);
      const mine = await repo.getSession(sessionId, { anonId });
      expect(mine?.messages.map((m) => m.role)).toEqual(["user"]);
      expect(await repo.getSession(sessionId, { anonId: anon() })).toBeNull();
      expect(await repo.getSession(sessionId, { userId: uuid() })).toBeNull();
      expect(await repo.getSession(uuid(), { anonId })).toBeNull();
    });

    it("listSessions devuelve solo las del ámbito, la más reciente primero", async () => {
      const anonId = anon();
      const a = newSessionId();
      const b = newSessionId();
      const other = newSessionId();
      await repo.upsertSession({ id: a, anonId, title: "A" });
      await repo.upsertSession({ id: b, anonId, title: "B" });
      await repo.upsertSession({ id: other, anonId: anon() });
      expect((await repo.listSessions({ anonId })).map((s) => s.id)).toEqual([b, a]);
      await repo.upsertSession({ id: a, anonId }); // A vuelve a ser la más reciente
      expect((await repo.listSessions({ anonId })).map((s) => s.id)).toEqual([a, b]);
    });

    it("listSessions y getSession exigen un ámbito", async () => {
      await expect(repo.listSessions({})).rejects.toThrow();
      await expect(repo.getSession(uuid(), {})).rejects.toThrow();
    });

    it("upsertUserFromSupabase crea una vez y actualiza solo lo que llega", async () => {
      const supabaseUserId = newSupabaseId();
      const u1 = await repo.upsertUserFromSupabase({
        supabaseUserId,
        displayName: "Lucía",
        role: "parent",
      });
      expect(u1).toMatchObject({ supabaseUserId, displayName: "Lucía", role: "parent", grade: "6º" });
      const u2 = await repo.upsertUserFromSupabase({ supabaseUserId, displayName: "Lucía M." });
      expect(u2).toMatchObject({ id: u1.id, displayName: "Lucía M.", role: "parent" });
      const u3 = await repo.upsertUserFromSupabase({ supabaseUserId });
      expect(u3).toMatchObject({ id: u1.id, displayName: "Lucía M.", role: "parent", grade: "6º" });
    });

    it("las conversaciones de un usuario se listan por userId", async () => {
      const user = await repo.upsertUserFromSupabase({ supabaseUserId: newSupabaseId() });
      const sessionId = newSessionId();
      await repo.upsertSession({ id: sessionId, userId: user.id });
      expect((await repo.listSessions({ userId: user.id })).map((s) => s.id)).toEqual([sessionId]);
      expect(await repo.getSession(sessionId, { userId: user.id })).not.toBeNull();
      expect(await repo.getSession(sessionId, { anonId: anon() })).toBeNull();
    });

    it("M7: getUserSecurity/setSafeWordHash/updateUserFlags", async () => {
      const user = await repo.upsertUserFromSupabase({ supabaseUserId: newSupabaseId() });
      expect(await repo.getUserSecurity(user.id)).toEqual({
        safeWordHash: null,
        allowImages: true,
        allowVoice: true,
        allowText: true,
      });

      await repo.setSafeWordHash(user.id, "salt:hash");
      expect((await repo.getUserSecurity(user.id))?.safeWordHash).toBe("salt:hash");

      const updated = await repo.updateUserFlags(user.id, { allowImages: false });
      expect(updated).toEqual({ allowImages: false, allowVoice: true, allowText: true });
      expect(await repo.getUserSecurity(user.id)).toMatchObject({ allowImages: false, allowVoice: true });

      expect(await repo.getUserSecurity(uuid())).toBeNull();
      await expect(repo.setSafeWordHash(uuid(), "x")).rejects.toThrow();
      await expect(repo.updateUserFlags(uuid(), { allowVoice: false })).rejects.toThrow();
    });

    it("M7: getActivityInsight resume toda la actividad de la alumna y detecta la trampa", async () => {
      const user = await repo.upsertUserFromSupabase({ supabaseUserId: newSupabaseId() });
      const s1 = newSessionId();
      await repo.upsertSession({ id: s1, userId: user.id });
      await repo.insertMessages([
        { id: uuid(), sessionId: s1, role: "user", content: "3/4 + 1/2" },
        { id: uuid(), sessionId: s1, role: "assistant", content: "¿Qué datos tienes?" },
        { id: uuid(), sessionId: s1, role: "user", content: "dame la respuesta" },
      ]);
      // Una segunda conversación cuenta también: ya no hay desglose ni conversaciones "sin asignatura".
      const s2 = newSessionId();
      await repo.upsertSession({ id: s2, userId: user.id });
      await repo.insertMessages([{ id: uuid(), sessionId: s2, role: "user", content: "hola" }]);

      const insight = await repo.getActivityInsight(user.id);
      expect(insight).toMatchObject({ sessionCount: 2, messageCount: 4, answerRequests: 1 });
      expect(insight.lastActivity).not.toBeNull();

      const other = await repo.upsertUserFromSupabase({ supabaseUserId: newSupabaseId() });
      expect(await repo.getActivityInsight(other.id)).toEqual({
        sessionCount: 0,
        messageCount: 0,
        answerRequests: 0,
        lastActivity: null,
      });
    });

    it("M7: listAllUsers incluye el número de sesiones", async () => {
      const user = await repo.upsertUserFromSupabase({ supabaseUserId: newSupabaseId(), displayName: "Ana" });
      await repo.upsertSession({ id: newSessionId(), userId: user.id });
      const all = await repo.listAllUsers();
      const found = all.find((u) => u.id === user.id);
      expect(found).toMatchObject({ displayName: "Ana", sessionCount: 1 });
    });

    it("M7: getAiConfig/setAiConfig", async () => {
      // Una base persistente (Neon) conserva la fila de una ejecución anterior: se parte y se termina limpio.
      await repo.deleteAiConfig("OPENROUTER_MODEL_TEST");
      expect((await repo.getAiConfig())["OPENROUTER_MODEL_TEST"]).toBeUndefined();
      await repo.setAiConfig("OPENROUTER_MODEL_TEST", "deepseek/deepseek-v4-flash-0731:free", "admin@eli.ngo");
      expect((await repo.getAiConfig())["OPENROUTER_MODEL_TEST"]).toBe("deepseek/deepseek-v4-flash-0731:free");
      await repo.setAiConfig("OPENROUTER_MODEL_TEST", "inclusionai/ling-3.0-flash:free", "admin@eli.ngo");
      expect((await repo.getAiConfig())["OPENROUTER_MODEL_TEST"]).toBe("inclusionai/ling-3.0-flash:free");
      await repo.deleteAiConfig("OPENROUTER_MODEL_TEST");
    });

    it("deleteAiConfig quita la fila y no falla si no existía", async () => {
      await repo.setAiConfig("delete_me_test", "x", "admin@eli.ngo");
      expect((await repo.getAiConfig())["delete_me_test"]).toBe("x");
      await repo.deleteAiConfig("delete_me_test");
      expect((await repo.getAiConfig())["delete_me_test"]).toBeUndefined();
      await expect(repo.deleteAiConfig("delete_me_test")).resolves.toBeUndefined();
    });

    it("feature flags por cuenta: set, update, delete y aislamiento entre cuentas", async () => {
      const a = await repo.upsertUserFromSupabase({ supabaseUserId: newSupabaseId() });
      const b = await repo.upsertUserFromSupabase({ supabaseUserId: newSupabaseId() });
      expect(await repo.getAccountFlags(a.id)).toEqual({});

      await repo.setAccountFlag(a.id, "voice_mode", false, "admin@eli.ngo");
      await repo.setAccountFlag(a.id, "image_mode", false, "admin@eli.ngo");
      expect(await repo.getAccountFlags(a.id)).toEqual({ voice_mode: false, image_mode: false });
      expect(await repo.getAccountFlags(b.id)).toEqual({});

      await repo.setAccountFlag(a.id, "voice_mode", true, "admin@eli.ngo");
      expect(await repo.getAccountFlags(a.id)).toEqual({ voice_mode: true, image_mode: false });

      // null = quitar el override (vuelve a seguir al global); quitar uno inexistente no falla.
      await repo.setAccountFlag(a.id, "voice_mode", null, "admin@eli.ngo");
      await repo.setAccountFlag(a.id, "voice_mode", null, "admin@eli.ngo");
      expect(await repo.getAccountFlags(a.id)).toEqual({ image_mode: false });

      const found = (await repo.listAllUsers()).find((u) => u.id === a.id);
      expect(found?.flagOverrides).toEqual({ image_mode: false });
    });

    it("allowImages/allowVoice de getUserSecurity y updateUserFlags viven en los flags por cuenta", async () => {
      const user = await repo.upsertUserFromSupabase({ supabaseUserId: newSupabaseId() });
      await repo.updateUserFlags(user.id, { allowVoice: false });
      expect(await repo.getAccountFlags(user.id)).toEqual({ voice_mode: false });
      expect(await repo.getUserSecurity(user.id)).toMatchObject({ allowVoice: false, allowImages: true });

      await repo.setAccountFlag(user.id, "image_mode", false, "admin@eli.ngo");
      expect(await repo.getUserSecurity(user.id)).toMatchObject({ allowVoice: false, allowImages: false });

      // allowText sigue en `users` y un patch vacío no cambia nada.
      expect(await repo.updateUserFlags(user.id, { allowText: false })).toEqual({
        allowImages: false,
        allowVoice: false,
        allowText: false,
      });
      expect(await repo.updateUserFlags(user.id, {})).toEqual({
        allowImages: false,
        allowVoice: false,
        allowText: false,
      });
    });
  });
}

repoSuite("en memoria", new MemoryRepo());

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl) {
  const neon = new NeonRepo(databaseUrl);
  repoSuite("Neon", neon, async (sessionIds, supabaseIds) => {
    if (sessionIds.length) {
      await neon.db.delete(chatSessions).where(inArray(chatSessions.id, sessionIds));
    }
    if (supabaseIds.length) {
      await neon.db.delete(users).where(inArray(users.supabaseUserId, supabaseIds));
    }
  });
} else {
  describe.skip("repositorio Neon (sin DATABASE_URL)", () => {
    it("se omite", () => {});
  });
}

describe("getRepo", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetEnvCache();
    resetRepo();
  });

  it("elige MemoryRepo sin DATABASE_URL y NeonRepo con ella", () => {
    vi.stubEnv("DATABASE_URL", "");
    resetEnvCache();
    resetRepo();
    expect(getRepo().kind).toBe("memory");
    expect(getRepo()).toBe(getRepo());

    vi.stubEnv("DATABASE_URL", "postgresql://user:pass@ep-test.neon.tech/neondb?sslmode=require");
    resetEnvCache();
    resetRepo();
    expect(getRepo().kind).toBe("neon");
  });
});

describe("migraciones versionadas", () => {
  it("drizzle/0000_init.sql refleja el esquema 6.5", () => {
    const sql = readFileSync(resolve(process.cwd(), "drizzle/0000_init.sql"), "utf8");
    for (const expected of [
      'CREATE TABLE "users"',
      'CREATE TABLE "chat_sessions"',
      'CREATE TABLE "messages"',
      "messages_session_created_idx",
      "ON DELETE cascade",
      "ON DELETE set null",
    ]) {
      expect(sql).toContain(expected);
    }
  });
});
