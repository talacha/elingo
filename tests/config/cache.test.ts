import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invalidate, readThrough, resetConfigCache } from "@/lib/config/cache";
import { getEffectiveFlags, setAccountFlag, setGlobalFlag } from "@/lib/config/flags";
import { CONFIG_ROWS_KEY, getConfigRows, resetConfigStore, setConfigRow } from "@/lib/config/store";
import { getRepo, resetRepo } from "@/lib/db";

/** Redis de mentira: guarda en un Map y deja ver qué se leyó, escribió y borró. */
const redisState = vi.hoisted(() => ({ down: false, data: new Map<string, unknown>() }));
const fakeRedis = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
}));

vi.mock("@/lib/ratelimit", () => ({
  hasRedisCredentials: () => true,
  createRedisFromEnv: () => fakeRedis,
}));

beforeEach(() => {
  redisState.down = false;
  redisState.data.clear();
  fakeRedis.get.mockReset().mockImplementation(async (key: string) => {
    if (redisState.down) throw new Error("redis down");
    return redisState.data.get(key) ?? null;
  });
  fakeRedis.set.mockReset().mockImplementation(async (key: string, value: unknown) => {
    if (redisState.down) throw new Error("redis down");
    redisState.data.set(key, structuredClone(value));
    return "OK";
  });
  fakeRedis.del.mockReset().mockImplementation(async (...keys: string[]) => {
    if (redisState.down) throw new Error("redis down");
    for (const key of keys) redisState.data.delete(key);
    return keys.length;
  });
  resetConfigCache();
  resetConfigStore();
  resetRepo();
});

afterEach(() => {
  vi.restoreAllMocks();
  resetConfigCache();
  resetConfigStore();
  resetRepo();
});

describe("readThrough (memoria → Redis → Postgres)", () => {
  it("carga de la fuente una vez, la guarda en Redis con TTL y sirve las siguientes desde memoria", async () => {
    const loader = vi.fn().mockResolvedValue({ a: "1" });

    expect(await readThrough("k", loader)).toEqual({ a: "1" });
    expect(await readThrough("k", loader)).toEqual({ a: "1" });

    expect(loader).toHaveBeenCalledTimes(1);
    expect(fakeRedis.get).toHaveBeenCalledTimes(1);
    expect(fakeRedis.set).toHaveBeenCalledWith("k", { a: "1" }, { ex: 300 });
  });

  it("otra instancia (memoria vacía) lee de Redis sin tocar Postgres", async () => {
    const loader = vi.fn().mockResolvedValue({ a: "1" });
    await readThrough("k", loader);

    resetConfigCache(); // memoria de otra instancia
    const otherLoader = vi.fn().mockResolvedValue({ a: "distinto" });
    expect(await readThrough("k", otherLoader)).toEqual({ a: "1" });
    expect(otherLoader).not.toHaveBeenCalled();
  });

  it("la memoria caduca a los 5 s y vuelve a mirar Redis (acota lo que tarda otra instancia en ver un cambio)", async () => {
    const now = vi.spyOn(Date, "now");
    now.mockReturnValue(1_000_000);
    const loader = vi.fn().mockResolvedValue({ a: "1" });
    await readThrough("k", loader);
    expect(fakeRedis.get).toHaveBeenCalledTimes(1);

    now.mockReturnValue(1_004_000);
    await readThrough("k", loader);
    expect(fakeRedis.get).toHaveBeenCalledTimes(1);

    now.mockReturnValue(1_006_000);
    await readThrough("k", loader);
    expect(fakeRedis.get).toHaveBeenCalledTimes(2);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("invalidate borra memoria y Redis: la siguiente lectura va a Postgres", async () => {
    const loader = vi.fn().mockResolvedValueOnce({ v: 1 }).mockResolvedValueOnce({ v: 2 });
    expect(await readThrough("k", loader)).toEqual({ v: 1 });

    await invalidate("k");
    expect(fakeRedis.del).toHaveBeenCalledWith("k");
    expect(await readThrough("k", loader)).toEqual({ v: 2 });
  });

  it("si Redis está caído, lee de Postgres y no lanza (ni al leer, ni al escribir, ni al invalidar)", async () => {
    redisState.down = true;
    const loader = vi.fn().mockResolvedValue({ a: "1" });

    expect(await readThrough("k", loader)).toEqual({ a: "1" });
    await expect(invalidate("k")).resolves.toBeUndefined();
    expect(await readThrough("k", loader)).toEqual({ a: "1" });
  });

  it("si la fuente falla, el error llega al llamador y no se cachea nada", async () => {
    const loader = vi.fn().mockRejectedValueOnce(new Error("neon caído")).mockResolvedValueOnce({ ok: true });
    await expect(readThrough("k", loader)).rejects.toThrow("neon caído");
    expect(fakeRedis.set).not.toHaveBeenCalled();
    expect(await readThrough("k", loader)).toEqual({ ok: true });
  });
});

describe("config y flags sobre Redis", () => {
  it("getConfigRows lee de Postgres una vez y después de la caché; setConfigRow la invalida", async () => {
    const repo = getRepo();
    await repo.setAiConfig("base_model", "openrouter/free", "seed");
    const getSpy = vi.spyOn(repo, "getAiConfig");

    expect((await getConfigRows()).base_model).toBe("openrouter/free");
    expect((await getConfigRows()).base_model).toBe("openrouter/free");
    expect(getSpy).toHaveBeenCalledTimes(1);
    expect(redisState.data.get(CONFIG_ROWS_KEY)).toEqual({ base_model: "openrouter/free" });

    await setConfigRow("base_model", "nvidia/nemotron-3.5-lightning:free", "admin@eli.ngo");
    expect((await getConfigRows()).base_model).toBe("nvidia/nemotron-3.5-lightning:free");
    expect(getSpy).toHaveBeenCalledTimes(2);
  });

  it("si Postgres falla y no hay caché, usa el último valor conocido (vacío al arrancar) sin lanzar", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const repo = getRepo();
    vi.spyOn(repo, "getAiConfig").mockRejectedValue(new Error("neon caído"));
    expect(await getConfigRows()).toEqual({});
  });

  it("los flags de una cuenta se cachean en Redis y setAccountFlag los invalida al instante", async () => {
    const repo = getRepo();
    const user = await repo.upsertUserFromSupabase({ supabaseUserId: "sb-cache-1" });
    const getSpy = vi.spyOn(repo, "getAccountFlags");

    expect((await getEffectiveFlags(user.id)).voice_mode).toBe(true);
    expect((await getEffectiveFlags(user.id)).voice_mode).toBe(true);
    expect(getSpy).toHaveBeenCalledTimes(1);
    expect(redisState.data.get(`eli:cfg:flags:${user.id}`)).toEqual({});

    await setAccountFlag(user.id, "voice_mode", false, "parent");
    expect((await getEffectiveFlags(user.id)).voice_mode).toBe(false);
  });

  it("setGlobalFlag invalida las filas de config para todos", async () => {
    expect((await getEffectiveFlags()).image_mode).toBe(true);
    await setGlobalFlag("image_mode", false, "admin@eli.ngo");
    expect((await getEffectiveFlags()).image_mode).toBe(false);
  });
});
