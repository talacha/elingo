import { describe, expect, it, vi } from "vitest";
import { createTutorChat, type TutorChat, type TutorChatState } from "@/components/chat/useTutorChat";

const encoder = new TextEncoder();
const HEADERS = { "content-type": "text/plain; charset=utf-8", "x-provider": "mock", "x-model": "mock-1" };

type Responder = () => Response;

/** `fetch` simulado: contesta con cada responder por orden (el último se repite). */
function fakeFetch(...responders: Responder[]) {
  let n = 0;
  return vi.fn(async (): Promise<Response> => {
    const responder = responders[Math.min(n, responders.length - 1)];
    n += 1;
    if (!responder) throw new Error("fakeFetch sin respuestas");
    return responder();
  });
}

function textStream(chunks: string[]) {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: HEADERS });
}

/** Stream gobernado desde el test: simula la espera y el botón «Parar». */
function manualStream() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  return {
    response: new Response(stream, { status: 200, headers: HEADERS }),
    push: (text: string) => controller.enqueue(encoder.encode(text)),
    close: () => controller.close(),
  };
}

const failure = () =>
  new Response(JSON.stringify({ error: "upstream_error", message: "Ups" }), {
    status: 500,
    headers: { "content-type": "application/json" },
  });

function make(fetch: ReturnType<typeof fakeFetch>) {
  const map = new Map<string, string>();
  return createTutorChat({
    fetch: fetch as never,
    storage: { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) },
  });
}

/** Espera (con tope) a que el estado cumpla la condición. */
function until(chat: TutorChat, predicate: (state: TutorChatState) => boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    if (predicate(chat.getState())) return resolve();
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

const lastId = (chat: TutorChat) => chat.getState().messages.at(-1)?.id ?? null;
const lastContent = (state: TutorChatState) => state.messages.at(-1)?.content;

describe("createTutorChat: respuesta hablada (voz automática)", () => {
  it("una pregunta hablada marca la respuesta terminada para leerla en voz alta", async () => {
    const chat = make(fakeFetch(() => textStream(["Vamos ", "paso a paso."])));
    expect(chat.getState().speakReplyId).toBeNull();

    await chat.send("Hola", undefined, { spoken: true });

    expect(chat.getState().status).toBe("idle");
    expect(chat.getState().messages.at(-1)?.role).toBe("assistant");
    expect(chat.getState().speakReplyId).toBe(lastId(chat));
  });

  it("no se marca mientras ELI aún está escribiendo, solo al terminar", async () => {
    const stream = manualStream();
    const chat = make(fakeFetch(() => stream.response));

    const turn = chat.send("Hola", undefined, { spoken: true });
    await until(chat, (s) => s.status === "streaming");
    stream.push("Primero, ");
    await until(chat, (s) => lastContent(s) === "Primero, ");
    expect(chat.getState().speakReplyId).toBeNull();

    stream.close();
    await turn;
    expect(chat.getState().speakReplyId).toBe(lastId(chat));
  });

  it("una pregunta escrita nunca se lee en voz alta", async () => {
    const chat = make(fakeFetch(() => textStream(["Hola."])));
    await chat.send("Hola");
    expect(chat.getState().speakReplyId).toBeNull();
    await chat.send("Otra", undefined, { spoken: false });
    expect(chat.getState().speakReplyId).toBeNull();
  });

  it("un envío escrito después de uno hablado limpia la marca", async () => {
    const chat = make(fakeFetch(() => textStream(["Uno."]), () => textStream(["Dos."])));
    await chat.send("Hablada", undefined, { spoken: true });
    expect(chat.getState().speakReplyId).not.toBeNull();

    await chat.send("Escrita");
    expect(chat.getState().speakReplyId).toBeNull();
  });

  it("si el turno falla no hay voz", async () => {
    const chat = make(fakeFetch(failure));
    await chat.send("Hola", undefined, { spoken: true });
    expect(chat.getState().status).toBe("error");
    expect(chat.getState().speakReplyId).toBeNull();
  });

  it("si la niña pulsa «Parar», lo dicho a medias no se lee", async () => {
    const stream = manualStream();
    const chat = make(fakeFetch(() => stream.response));

    const turn = chat.send("Hola", undefined, { spoken: true });
    await until(chat, (s) => s.status === "streaming");
    stream.push("Primero, ");
    await until(chat, (s) => lastContent(s) === "Primero, ");
    chat.stop();
    await turn;

    expect(chat.getState().status).toBe("idle");
    expect(chat.getState().speakReplyId).toBeNull();
  });

  it("reintentar una pregunta hablada conserva la voz", async () => {
    const chat = make(fakeFetch(failure, () => textStream(["Ahora sí."])));
    await chat.send("Hola", undefined, { spoken: true });
    expect(chat.getState().speakReplyId).toBeNull();

    await chat.retry();
    expect(chat.getState().speakReplyId).toBe(lastId(chat));
  });

  it("empezar una conversación nueva o cargar otra limpia la marca", async () => {
    const chat = make(fakeFetch(() => textStream(["Hola."])));
    await chat.send("Hola", undefined, { spoken: true });
    expect(chat.getState().speakReplyId).not.toBeNull();
    chat.newSession();
    expect(chat.getState().speakReplyId).toBeNull();

    await chat.send("Hola", undefined, { spoken: true });
    chat.loadMessages([]);
    expect(chat.getState().speakReplyId).toBeNull();
  });
});
