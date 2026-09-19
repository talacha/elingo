import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as chatPOST } from "@/app/api/chat/route";
import { POST as speechPOST } from "@/app/api/speech/route";
import { POST as transcribePOST } from "@/app/api/transcribe/route";
import { GET as capabilitiesGET } from "@/app/api/chat/capabilities/route";
import { PATCH as parentsPATCH } from "@/app/api/parents/settings/route";
import { resetConfigCache } from "@/lib/config/cache";
import { setAccountFlag, setGlobalFlag } from "@/lib/config/flags";
import { resetConfigStore } from "@/lib/config/store";
import { getRepo, resetRepo } from "@/lib/db";
import { resetEnvCache } from "@/lib/env";
import { resetRateLimiter } from "@/lib/ratelimit";
import { createUnlockToken } from "@/lib/auth/parentUnlock";
import { PARENT_UNLOCK_COOKIE } from "@/lib/contracts/parents";

vi.mock("@upstash/qstash", () => ({
  Client: vi.fn().mockImplementation(() => ({ publishJSON: vi.fn().mockResolvedValue({}) })),
}));
vi.mock("next/server", async () => {
  const actual = await vi.importActual("next/server");
  return { ...actual, after: vi.fn() };
});
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("@/lib/ai/speech", () => ({
  synthesizeSpeech: vi.fn().mockResolvedValue({
    audio: new ReadableStream<Uint8Array>({ start: (c) => c.close() }),
    contentType: "audio/mpeg",
  }),
}));
vi.mock("@/lib/ai/transcribe", () => ({ transcribeAudio: vi.fn().mockResolvedValue("hola") }));

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { synthesizeSpeech } from "@/lib/ai/speech";
import { transcribeAudio } from "@/lib/ai/transcribe";

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new NextRequest(`http://localhost:3000${path}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", ...headers },
  });

const imageChat = () =>
  post("/api/chat", {
    sessionId: crypto.randomUUID(),
    messages: [
      {
        id: crypto.randomUUID(),
        role: "user",
        content: "Mira esta foto",
        image: { mediaType: "image/jpeg", data: "fake-base64-data" },
      },
    ],
  });
const textChat = () =>
  post("/api/chat", {
    sessionId: crypto.randomUUID(),
    messages: [{ id: crypto.randomUUID(), role: "user", content: "¿Cuánto es 2+2?" }],
  });
const speech = () => post("/api/speech", { text: "Hola" });
const transcribe = () => post("/api/transcribe", { audio: "abc", mimeType: "audio/webm" });

async function signIn(supabaseId: string) {
  vi.mocked(createSupabaseServerClient).mockResolvedValue({
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: supabaseId, email: "a@b.com" } } }),
    },
  } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);
  return getRepo().upsertUserFromSupabase({ supabaseUserId: supabaseId });
}

function reset() {
  resetEnvCache();
  resetRateLimiter();
  resetRepo();
  resetConfigCache();
  resetConfigStore();
}

beforeEach(() => {
  reset();
  vi.mocked(createSupabaseServerClient).mockResolvedValue(null);
  vi.mocked(synthesizeSpeech).mockClear();
  vi.mocked(transcribeAudio).mockClear();
});
afterEach(reset);

describe("modo imagen (image_mode)", () => {
  it("con el flag encendido se aceptan las imágenes", async () => {
    expect((await chatPOST(imageChat())).status).toBe(200);
  });

  it("con el flag global apagado se rechazan, incluso para la alumna anónima; el texto sigue funcionando", async () => {
    await setGlobalFlag("image_mode", false, "admin@eli.ngo");

    const response = await chatPOST(imageChat());
    expect(response.status).toBe(400);
    expect((await response.json()).message).toContain("imágenes están desactivadas");
    expect((await chatPOST(textChat())).status).toBe(200);
  });

  it("con el flag apagado solo en la cuenta se rechazan para esa cuenta", async () => {
    const user = await signIn("sb-img-1");
    await setAccountFlag(user.id, "image_mode", false, "admin@eli.ngo");
    expect((await chatPOST(imageChat())).status).toBe(400);

    await signIn("sb-img-2");
    expect((await chatPOST(imageChat())).status).toBe(200);
  });
});

describe("modo voz (voice_mode)", () => {
  it("con el flag encendido /api/speech y /api/transcribe funcionan", async () => {
    expect((await speechPOST(speech())).status).toBe(200);
    expect((await transcribePOST(transcribe())).status).toBe(200);
  });

  it("con el flag global apagado responden 204 sin llamar al proveedor (alumna anónima incluida)", async () => {
    await setGlobalFlag("voice_mode", false, "admin@eli.ngo");

    expect((await speechPOST(speech())).status).toBe(204);
    expect((await transcribePOST(transcribe())).status).toBe(204);
    expect(synthesizeSpeech).not.toHaveBeenCalled();
    expect(transcribeAudio).not.toHaveBeenCalled();
  });

  it("con el flag apagado solo en la cuenta responden 204 para esa cuenta", async () => {
    const user = await signIn("sb-voice-1");
    await setAccountFlag(user.id, "voice_mode", false, "admin@eli.ngo");

    expect((await speechPOST(speech())).status).toBe(204);
    expect((await transcribePOST(transcribe())).status).toBe(204);
    expect(transcribeAudio).not.toHaveBeenCalled();
  });
});

describe("GET /api/chat/capabilities: flags → partes de la interfaz", () => {
  it("anónima con el global apagado: se ocultan micrófono y cámara", async () => {
    await setGlobalFlag("voice_mode", false, "admin@eli.ngo");
    await setGlobalFlag("image_mode", false, "admin@eli.ngo");
    expect(await (await capabilitiesGET()).json()).toEqual({
      allowImages: false,
      allowVoice: false,
      allowText: true,
    });
  });

  it("con sesión: cuenta Y global; allowText sigue siendo el interruptor de /parents", async () => {
    const user = await signIn("sb-cap-1");
    await setAccountFlag(user.id, "image_mode", false, "parent");
    await getRepo().updateUserFlags(user.id, { allowText: false });
    expect(await (await capabilitiesGET()).json()).toEqual({
      allowImages: false,
      allowVoice: true,
      allowText: false,
    });

    await setGlobalFlag("voice_mode", false, "admin@eli.ngo");
    expect((await (await capabilitiesGET()).json()).allowVoice).toBe(false);
  });
});

describe("PATCH /api/parents/settings escribe los flags de la cuenta y refresca la caché", () => {
  it("apagar voz desde /parents se ve en el acto en capabilities", async () => {
    const user = await signIn("sb-parent-1");
    // Se calienta la caché con el valor antiguo.
    expect((await (await capabilitiesGET()).json()).allowVoice).toBe(true);

    const token = await createUnlockToken(user.id);
    const response = await parentsPATCH(
      new NextRequest("http://localhost:3000/api/parents/settings", {
        method: "PATCH",
        body: JSON.stringify({ allowVoice: false }),
        headers: { "content-type": "application/json", cookie: `${PARENT_UNLOCK_COOKIE}=${token}` },
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ allowImages: true, allowVoice: false, allowText: true });

    expect((await (await capabilitiesGET()).json()).allowVoice).toBe(false);
    expect(await getRepo().getAccountFlags(user.id)).toEqual({ voice_mode: false });
  });
});
