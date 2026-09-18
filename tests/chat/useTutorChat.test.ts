import { describe, expect, it, vi } from "vitest";
import {
  CHAT_ENDPOINT,
  FRIENDLY_ERRORS,
  SESSION_STORAGE_KEY,
  canRetry,
  createTutorChat,
  describeWait,
  isThinking,
  type TutorChat,
  type TutorChatOptions,
  type TutorChatState,
} from "@/components/chat/useTutorChat";
import type { ChatRequest } from "@/lib/contracts/chat";

const encoder = new TextEncoder();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TEXT_HEADERS = {
  "content-type": "text/plain; charset=utf-8",
  "x-session-id": "servidor",
  "x-provider": "mock",
  "x-model": "mock-1",
};

type FetchInit = RequestInit & { body: string; signal: AbortSignal };
type Responder = (init: FetchInit) => Response | Promise<Response>;

/** `fetch` simulado: contesta con cada `responder` por orden (el último se repite). */
function fakeFetch(...responders: Responder[]) {
  const calls: FetchInit[] = [];
  const fn = vi.fn(async (_input: string, init: RequestInit): Promise<Response> => {
    const typed = init as FetchInit;
    calls.push(typed);
    const responder = responders[Math.min(calls.length, responders.length) - 1];
    if (!responder) throw new Error("fakeFetch sin respuestas");
    return responder(typed);
  });
  return Object.assign(fn, { calls });
}

function call(fetch: ReturnType<typeof fakeFetch>, index: number): FetchInit {
  const found = fetch.calls[index];
  if (!found) throw new Error(`no hubo llamada ${index}`);
  return found;
}

function bodyOf(init: FetchInit): ChatRequest {
  return JSON.parse(init.body) as ChatRequest;
}

function textStream(chunks: Array<string | Uint8Array>, headers: Record<string, string> = {}) {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(typeof chunk === "string" ? encoder.encode(chunk) : chunk);
      }
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { ...TEXT_HEADERS, ...headers } });
}

/** Stream gobernado desde el test: simula la espera, el botón «Parar» y un corte a medias. */
function manualStream() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  return {
    response: new Response(stream, { status: 200, headers: TEXT_HEADERS }),
    push: (text: string) => controller.enqueue(encoder.encode(text)),
    close: () => controller.close(),
    fail: (reason: string) => controller.error(new Error(reason)),
  };
}

function jsonError(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

function make(fetch: TutorChatOptions["fetch"], extra: Omit<TutorChatOptions, "fetch"> = {}) {
  return createTutorChat({ fetch, storage: memoryStorage(), ...extra });
}

/** Espera (con tope) a que el estado cumpla la condición. */
function until(chat: TutorChat, predicate: (state: TutorChatState) => boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    if (predicate(chat.getState())) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error("el estado esperado no llegó"));
    }, 2000);
    const unsubscribe = chat.subscribe(() => {
      if (!predicate(chat.getState())) return;
      clearTimeout(timer);
      unsubscribe();
      resolve();
    });
  });
}

const roles = (state: TutorChatState) => state.messages.map((m) => m.role);
const contents = (state: TutorChatState) => state.messages.map((m) => m.content);
const lastContent = (state: TutorChatState) => state.messages.at(-1)?.content;

describe("createTutorChat: envío y streaming", () => {
  it("envía el historial con el contrato 6.1 y acumula los deltas de ELI", async () => {
    const fetch = fakeFetch(() =>
      textStream(["¡Buen intento! ", "Vamos **paso a paso**.\n", "- ¿Qué datos tienes?"]),
    );
    const chat = make(fetch);

    const accepted = await chat.send(
      "  Tengo este problema: 3/4 + 1/2, me trabé en el denominador  ",
    );

    expect(accepted).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]?.[0]).toBe(CHAT_ENDPOINT);
    const init = call(fetch, 0);
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("content-type")).toBe("application/json");
    const body = bodyOf(init);
    expect(body.sessionId).toMatch(UUID);
    expect(body.subject).toBeUndefined();
    expect(body.messages).toHaveLength(1); // la burbuja vacía de ELI no viaja al servidor
    expect(body.messages[0]).toMatchObject({
      role: "user",
      content: "Tengo este problema: 3/4 + 1/2, me trabé en el denominador",
    });
    expect(body.messages[0]?.id).toMatch(UUID);

    const state = chat.getState();
    expect(state.status).toBe("idle");
    expect(state.error).toBeNull();
    expect(roles(state)).toEqual(["user", "assistant"]);
    expect(lastContent(state)).toBe("¡Buen intento! Vamos **paso a paso**.\n- ¿Qué datos tienes?");
    expect(state.meta).toEqual({ provider: "mock", model: "mock-1" });
  });

  it("está «pensando» desde el envío hasta el primer chunk", async () => {
    const stream = manualStream();
    const chat = make(fakeFetch(() => stream.response));

    const turn = chat.send("Hola");
    await until(chat, (s) => s.status === "streaming");
    expect(isThinking(chat.getState())).toBe(true);
    expect(chat.getState().messages.at(-1)).toMatchObject({ role: "assistant", content: "" });

    stream.push("¡Hola!");
    await until(chat, (s) => lastContent(s) === "¡Hola!");
    expect(isThinking(chat.getState())).toBe(false);
    expect(chat.getState().status).toBe("streaming");

    stream.close();
    await turn;
    expect(chat.getState().status).toBe("idle");
  });

  it("decodifica bien las tildes partidas entre chunks", async () => {
    const text = "¡Sí! Está bien: ñ, á, é.";
    const bytes = encoder.encode(text);
    // Cortes en medio de «¡» (2 bytes) y de «í» (2 bytes).
    const chat = make(
      fakeFetch(() => textStream([bytes.slice(0, 1), bytes.slice(1, 4), bytes.slice(4)])),
    );

    await chat.send("¿Así?");

    expect(lastContent(chat.getState())).toBe(text);
  });

  it("manda la asignatura cuando está fijada", async () => {
    const fetch = fakeFetch(() => textStream(["Ok"]));
    const chat = make(fetch, { subject: "mates" });

    await chat.send("Hola");
    chat.setSubject("lengua");
    await chat.send("Sigo");
    chat.setSubject(undefined);
    await chat.send("Y ahora");

    expect(bodyOf(call(fetch, 0)).subject).toBe("mates");
    expect(bodyOf(call(fetch, 1)).subject).toBe("lengua");
    expect(bodyOf(call(fetch, 2)).subject).toBeUndefined();
    expect(bodyOf(call(fetch, 2)).messages.map((m) => m.role)).toEqual([
      "user",
      "assistant",
      "user",
      "assistant",
      "user",
    ]);
  });

  it("ignora envíos vacíos, envíos durante el turno y reintentos sin pregunta pendiente", async () => {
    const stream = manualStream();
    const fetch = fakeFetch(() => stream.response);
    const chat = make(fetch);

    expect(await chat.send("   \n ")).toBe(false);
    expect(fetch).not.toHaveBeenCalled();

    const turn = chat.send("Hola");
    await until(chat, (s) => s.status === "streaming");
    expect(await chat.send("Otra cosa")).toBe(false);
    expect(await chat.retry()).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);

    stream.push("Ok");
    stream.close();
    await turn;
    expect(await chat.retry()).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("createTutorChat: errores amables", () => {
  it("429: usa el mensaje del servidor, conserva la pregunta y permite reintentar", async () => {
    const fetch = fakeFetch(
      () =>
        jsonError(
          429,
          {
            error: "rate_limited",
            message: "Espera un poquito, ELI está muy solicitado.",
            retryAfter: 30,
          },
          { "retry-after": "30" },
        ),
      () => textStream(["Sigamos."]),
    );
    const chat = make(fetch);

    await chat.send("Hola");
    let state = chat.getState();
    expect(state.status).toBe("error");
    expect(state.error).toEqual({
      code: "rate_limited",
      message: "Espera un poquito, ELI está muy solicitado.",
      retryAfter: 30,
    });
    expect(roles(state)).toEqual(["user"]); // sin burbuja vacía de ELI
    expect(canRetry(state)).toBe(true);
    const questionId = state.messages[0]?.id;

    await chat.retry();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(bodyOf(call(fetch, 1)).messages.map((m) => m.id)).toEqual([questionId]);
    state = chat.getState();
    expect(state.status).toBe("idle");
    expect(state.error).toBeNull();
    expect(contents(state)).toEqual(["Hola", "Sigamos."]);
  });

  it("429 sin mensaje del servidor: texto propio con la espera en palabras", async () => {
    const chat = make(fakeFetch(() => jsonError(429, { error: "rate_limited", retryAfter: 120 })));
    await chat.send("Hola");
    expect(chat.getState().error).toEqual({
      code: "rate_limited",
      retryAfter: 120,
      message: "ELI necesita un pequeño descanso. Espera 2 minutos y vuelve a intentarlo.",
    });

    const viaHeader = make(fakeFetch(() => jsonError(429, {}, { "retry-after": "45" })));
    await viaHeader.send("Hola");
    expect(viaHeader.getState().error).toMatchObject({ code: "rate_limited", retryAfter: 45 });
    expect(viaHeader.getState().error?.message).toContain("45 segundos");
  });

  it.each([
    [
      503,
      { error: "budget_exhausted", message: "" },
      "budget_exhausted",
      FRIENDLY_ERRORS.budget_exhausted,
    ],
    [
      500,
      { error: "upstream_error", message: "Ups, el tutor se ha atascado." },
      "upstream_error",
      "Ups, el tutor se ha atascado.",
    ],
    [
      400,
      { error: "invalid_request", message: "Tu mensaje es muy largo.", issues: [] },
      "invalid_request",
      "Tu mensaje es muy largo.",
    ],
    [401, { error: "unauthorized", message: "" }, "unauthorized", FRIENDLY_ERRORS.unauthorized],
    [502, "<html>bad gateway</html>", "upstream_error", FRIENDLY_ERRORS.upstream_error],
  ])(
    "responde al %i con un mensaje amable y sin burbuja vacía",
    async (status, body, code, message) => {
      const response =
        typeof body === "string"
          ? new Response(body, { status, headers: { "content-type": "text/html" } })
          : jsonError(status, body);
      const chat = make(fakeFetch(() => response));

      await chat.send("Hola");

      const state = chat.getState();
      expect(state.status).toBe("error");
      expect(state.error).toEqual({ code, message });
      expect(roles(state)).toEqual(["user"]);
      expect(canRetry(state)).toBe(true);
    },
  );

  it("fallo de red: error amable y la pregunta sigue ahí para reintentar", async () => {
    const chat = make(
      fakeFetch(() => {
        throw new TypeError("Failed to fetch");
      }),
    );

    await chat.send("Hola");

    const state = chat.getState();
    expect(state.status).toBe("error");
    expect(state.error).toEqual({ code: "network", message: FRIENDLY_ERRORS.network });
    expect(roles(state)).toEqual(["user"]);
    expect(canRetry(state)).toBe(true);
  });

  it("200 sin cuerpo o sin texto: se trata como error del proveedor", async () => {
    const chat = make(fakeFetch(() => new Response(null, { status: 200, headers: TEXT_HEADERS })));
    await chat.send("Hola");
    expect(chat.getState().error).toEqual({
      code: "upstream_error",
      message: FRIENDLY_ERRORS.upstream_error,
    });

    const blank = make(fakeFetch(() => textStream([])));
    await blank.send("Hola");
    expect(blank.getState().status).toBe("error");
    expect(blank.getState().error?.code).toBe("upstream_error");
    expect(roles(blank.getState())).toEqual(["user"]);
    expect(canRetry(blank.getState())).toBe(true);
  });

  it("corte a mitad de respuesta: conserva lo dicho y avisa sin ofrecer reintento", async () => {
    const stream = manualStream();
    const chat = make(fakeFetch(() => stream.response));

    const turn = chat.send("Hola");
    await until(chat, (s) => s.status === "streaming");
    stream.push("Empecemos por");
    await until(chat, (s) => lastContent(s) === "Empecemos por");
    stream.fail("boom");
    await turn;

    const state = chat.getState();
    expect(state.status).toBe("error");
    expect(state.error).toEqual({ code: "interrupted", message: FRIENDLY_ERRORS.interrupted });
    expect(contents(state)).toEqual(["Hola", "Empecemos por"]);
    expect(canRetry(state)).toBe(false);
  });

  it("un envío nuevo tras un error sustituye la pregunta huérfana y limpia el error", async () => {
    const fetch = fakeFetch(
      () => jsonError(503, { error: "budget_exhausted", message: "Mañana más." }),
      () => textStream(["Vale."]),
    );
    const chat = make(fetch);

    await chat.send("Primera");
    await chat.send("Segunda");

    expect(bodyOf(call(fetch, 1)).messages.map((m) => m.content)).toEqual(["Segunda"]);
    const state = chat.getState();
    expect(contents(state)).toEqual(["Segunda", "Vale."]);
    expect(state.status).toBe("idle");
    expect(state.error).toBeNull();
  });
});

describe("createTutorChat: botón «Parar»", () => {
  it("corta el stream y conserva lo que ELI había dicho", async () => {
    const stream = manualStream();
    const fetch = fakeFetch(() => stream.response);
    const chat = make(fetch);

    const turn = chat.send("Hola");
    await until(chat, (s) => s.status === "streaming");
    stream.push("Primero, ");
    await until(chat, (s) => lastContent(s) === "Primero, ");
    chat.stop();
    await turn;

    const state = chat.getState();
    expect(call(fetch, 0).signal.aborted).toBe(true);
    expect(state.status).toBe("idle");
    expect(state.error).toBeNull();
    expect(contents(state)).toEqual(["Hola", "Primero, "]);
    expect(canRetry(state)).toBe(false);
  });

  it("si para mientras ELI piensa, quita la burbuja vacía y deja reintentar", async () => {
    const fetch = fakeFetch(
      (init) =>
        new Promise<Response>((_, reject) => {
          init.signal.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    const chat = make(fetch);

    const turn = chat.send("Hola");
    await until(chat, (s) => s.status === "streaming");
    expect(isThinking(chat.getState())).toBe(true);
    chat.stop();
    await turn;

    const state = chat.getState();
    expect(state.status).toBe("idle");
    expect(state.error).toBeNull();
    expect(roles(state)).toEqual(["user"]);
    expect(canRetry(state)).toBe(true);
  });

  it("no hace nada si no hay turno en curso", () => {
    const chat = make(fakeFetch(() => textStream(["Ok"])));
    expect(() => chat.stop()).not.toThrow();
    expect(chat.getState().status).toBe("idle");
  });
});

describe("createTutorChat: sessionId", () => {
  it("crea un uuid, lo guarda en el almacenamiento y lo reutiliza", async () => {
    const storage = memoryStorage();
    const fetch = fakeFetch(() => textStream(["Ok"]));

    const first = createTutorChat({ fetch, storage });
    await first.send("Hola");
    const id = bodyOf(call(fetch, 0)).sessionId;
    expect(id).toMatch(UUID);
    expect(storage.map.get(SESSION_STORAGE_KEY)).toBe(id);

    await first.send("Sigo");
    expect(bodyOf(call(fetch, 1)).sessionId).toBe(id);

    const second = createTutorChat({ fetch, storage }); // otra carga de la página
    await second.send("Hola otra vez");
    expect(bodyOf(call(fetch, 2)).sessionId).toBe(id);
  });

  it("regenera el uuid si lo guardado está corrupto", async () => {
    const storage = memoryStorage({ [SESSION_STORAGE_KEY]: "no-es-un-uuid" });
    const fetch = fakeFetch(() => textStream(["Ok"]));

    await createTutorChat({ fetch, storage }).send("Hola");

    const id = bodyOf(call(fetch, 0)).sessionId;
    expect(id).toMatch(UUID);
    expect(storage.map.get(SESSION_STORAGE_KEY)).toBe(id);
  });

  it("sigue funcionando si el almacenamiento está bloqueado", async () => {
    const blocked = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("SecurityError");
      },
    };
    const fetch = fakeFetch(() => textStream(["Ok"]));
    const chat = createTutorChat({ fetch, storage: blocked });

    await chat.send("Hola");
    await chat.send("Sigo");

    const id = bodyOf(call(fetch, 0)).sessionId;
    expect(id).toMatch(UUID);
    expect(bodyOf(call(fetch, 1)).sessionId).toBe(id);
  });

  it("usa el generador inyectado", async () => {
    const fetch = fakeFetch(() => textStream(["Ok"]));
    const fixed = "123e4567-e89b-42d3-a456-426614174000";
    await createTutorChat({ fetch, storage: null, randomUUID: () => fixed }).send("Hola");
    expect(bodyOf(call(fetch, 0)).sessionId).toBe(fixed);
  });
});

describe("describeWait", () => {
  it("habla en segundos o minutos según la espera", () => {
    expect(describeWait(1)).toBe("1 segundo");
    expect(describeWait(0.4)).toBe("1 segundo");
    expect(describeWait(30)).toBe("30 segundos");
    expect(describeWait(90)).toBe("2 minutos");
    expect(describeWait(600)).toBe("10 minutos");
  });
});

describe("createTutorChat: imágenes adjuntas", () => {
  it("envía la imagen cuando se proporciona", async () => {
    const fetch = fakeFetch(() => textStream(["Ok"]));
    const chat = make(fetch);

    const image = { mediaType: "image/webp" as const, data: "base64encodeddata" };
    await chat.send("Aquí está el problema", image);

    const body = bodyOf(call(fetch, 0));
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0]?.image).toEqual(image);
    expect(body.messages[0]?.content).toBe("Aquí está el problema");
  });

  it("omite la imagen si no se proporciona", async () => {
    const fetch = fakeFetch(() => textStream(["Ok"]));
    const chat = make(fetch);

    await chat.send("Solo texto, sin foto");

    const body = bodyOf(call(fetch, 0));
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0]?.image).toBeUndefined();
    expect(body.messages[0]?.content).toBe("Solo texto, sin foto");
  });
});
