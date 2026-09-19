import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetConfigCache } from "@/lib/config/cache";
import {
  getAccountFlagValues,
  getEffectiveFlags,
  getGlobalFlags,
  setAccountFlag,
  setGlobalFlag,
} from "@/lib/config/flags";
import { resetConfigStore } from "@/lib/config/store";
import { getRepo, resetRepo } from "@/lib/db";
import { resetEnvCache } from "@/lib/env";

function reset() {
  resetEnvCache();
  resetRepo();
  resetConfigCache();
  resetConfigStore();
}

beforeEach(reset);
afterEach(() => {
  vi.restoreAllMocks();
  reset();
});

async function newUser(id: string) {
  return getRepo().upsertUserFromSupabase({ supabaseUserId: id });
}

describe("feature flags: global Y cuenta", () => {
  it("por defecto todo activo, con o sin cuenta", async () => {
    const user = await newUser("sb-1");
    expect(await getEffectiveFlags()).toEqual({ voice_mode: true, image_mode: true });
    expect(await getEffectiveFlags(user.id)).toEqual({ voice_mode: true, image_mode: true });
  });

  it("la cuenta puede apagar un flag sin afectar a las demás ni al resto de flags", async () => {
    const a = await newUser("sb-a");
    const b = await newUser("sb-b");
    await setAccountFlag(a.id, "voice_mode", false, "parent");

    expect(await getEffectiveFlags(a.id)).toEqual({ voice_mode: false, image_mode: true });
    expect(await getEffectiveFlags(b.id)).toEqual({ voice_mode: true, image_mode: true });
    expect(await getEffectiveFlags()).toEqual({ voice_mode: true, image_mode: true });
  });

  it("apagar el global lo apaga para todos, también para la alumna anónima", async () => {
    const user = await newUser("sb-1");
    await setGlobalFlag("image_mode", false, "admin@eli.ngo");

    expect((await getEffectiveFlags()).image_mode).toBe(false);
    expect((await getEffectiveFlags(user.id)).image_mode).toBe(false);
    expect((await getEffectiveFlags(user.id)).voice_mode).toBe(true);
  });

  it("el global apagado gana aunque la cuenta lo tenga explícitamente encendido", async () => {
    const user = await newUser("sb-1");
    await setAccountFlag(user.id, "voice_mode", true, "admin@eli.ngo");
    await setGlobalFlag("voice_mode", false, "admin@eli.ngo");
    expect((await getEffectiveFlags(user.id)).voice_mode).toBe(false);
  });

  it("volver a encender el global respeta lo que la cuenta apagó", async () => {
    const user = await newUser("sb-1");
    await setAccountFlag(user.id, "voice_mode", false, "parent");
    await setGlobalFlag("voice_mode", false, "admin@eli.ngo");
    await setGlobalFlag("voice_mode", true, "admin@eli.ngo");
    expect((await getEffectiveFlags(user.id)).voice_mode).toBe(false);
  });

  it("quitar el override de la cuenta (null) vuelve a seguir al global", async () => {
    const user = await newUser("sb-1");
    await setAccountFlag(user.id, "image_mode", false, "parent");
    await setAccountFlag(user.id, "image_mode", null, "parent");
    expect((await getEffectiveFlags(user.id)).image_mode).toBe(true);
  });

  it("getAccountFlagValues es el interruptor de la cuenta sin mezclar el global (lo que ve /parents)", async () => {
    const user = await newUser("sb-1");
    await setGlobalFlag("voice_mode", false, "admin@eli.ngo");
    await setAccountFlag(user.id, "image_mode", false, "parent");
    expect(await getAccountFlagValues(user.id)).toEqual({ voice_mode: true, image_mode: false });
  });

  it("valores basura en app_config se ignoran y queda el valor por defecto", async () => {
    await getRepo().setAiConfig("flag.voice_mode", "quizás", "seed");
    expect((await getGlobalFlags()).voice_mode).toBe(true);
  });

  it("falla abierto: si Postgres no responde, los flags quedan activos y nunca lanza", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const repo = getRepo();
    vi.spyOn(repo, "getAiConfig").mockRejectedValue(new Error("neon caído"));
    vi.spyOn(repo, "getAccountFlags").mockRejectedValue(new Error("neon caído"));

    expect(await getEffectiveFlags("cualquiera")).toEqual({ voice_mode: true, image_mode: true });
  });
});
