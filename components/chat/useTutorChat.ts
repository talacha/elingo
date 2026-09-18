"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  CHAT_HEADERS,
  type ChatError,
  type ChatErrorCode,
  type ChatImage,
  type ChatMessage,
  type ChatRequest,
  type Subject,
} from "@/lib/contracts/chat";

/*
  Motor del chat con ELI (T-014).

  Toda la lógica vive en `createTutorChat`, un store pequeño y sin React que se prueba en Node
  con un `fetch` simulado (tests/chat/useTutorChat.test.ts). `useTutorChat` es la envoltura que
  lo conecta a React con useSyncExternalStore.

  Contrato: tasks.md, sección 6.1. El servidor responde `text/plain` en streaming y los errores
  llegan como JSON `ChatError` con un mensaje amable en español.
*/

export type ChatStatus = "idle" | "streaming" | "error";

/** Códigos del contrato más dos propios del cliente: sin conexión y stream cortado a medias. */
export type TutorChatErrorCode = ChatErrorCode | "network" | "interrupted";

export interface TutorChatError {
  code: TutorChatErrorCode;
  /** Texto amable, en español, listo para mostrar a la niña. */
  message: string;
  /** Segundos de espera sugeridos (solo rate_limited). */
  retryAfter?: number;
}

export interface TutorChatState {
  /** Historial completo. Mientras ELI responde, el último mensaje es el suyo y crece con cada delta. */
  messages: ChatMessage[];
  status: ChatStatus;
  error: TutorChatError | null;
  subject?: Subject;
  /** Cabeceras informativas de la última respuesta 200 (`x-provider`, `x-model`). */
  meta: { provider: string | null; model: string | null } | null;
}

export interface TutorChatOptions {
  /** Ruta del endpoint (por defecto `/api/chat`). */
  endpoint?: string;
  /** `fetch` inyectable para los tests. Por defecto, el global. */
  fetch?: (input: string, init: RequestInit) => Promise<Response>;
  /** Dónde guardar el `sessionId`: por defecto `localStorage`; `null` = solo en memoria. */
  storage?: Pick<Storage, "getItem" | "setItem"> | null;
  subject?: Subject;
  /** Generador de uuid inyectable para los tests. */
  randomUUID?: () => string;
}

export interface TutorChat {
  getState(): TutorChatState;
  subscribe(listener: () => void): () => void;
  /** Envía un mensaje de la niña. Resuelve al terminar el turno; `false` si se ignoró (vacío o turno en curso). */
  send(text: string, image?: ChatImage): Promise<boolean>;
  /** Reenvía la última pregunta sin respuesta (tras un error o un «Parar» temprano). */
  retry(): Promise<boolean>;
  /** Detiene el turno en curso conservando lo que ELI haya dicho ya. */
  stop(): void;
  setSubject(subject: Subject | undefined): void;
  /** Carga un historial de mensajes desde una sesión guardada. */
  loadMessages(messages: ChatMessage[], subject?: Subject): void;
  /** Inicia una nueva conversación: nuevo sessionId y limpia el historial. */
  newSession(): void;
  /** Obtiene el sessionId actual. */
  getSessionId(): string;
}

export const CHAT_ENDPOINT = "/api/chat";
export const SESSION_STORAGE_KEY = "eli:sessionId";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ERROR_CODES: ReadonlySet<string> = new Set<ChatErrorCode>([
  "invalid_request",
  "rate_limited",
  "budget_exhausted",
  "unauthorized",
  "upstream_error",
]);

/** Mensajes amables para la niña, uno por código. Se usan cuando el servidor no manda el suyo. */
export const FRIENDLY_ERRORS: Record<TutorChatErrorCode, string> = {
  rate_limited: "ELI necesita un pequeño descanso. Espera un momentito y vuelve a intentarlo.",
  budget_exhausted: "ELI ha trabajado muchísimo hoy y ya no le quedan fuerzas. ¡Mañana seguimos!",
  upstream_error: "Ups, algo se enredó por dentro. Vamos a intentarlo otra vez.",
  invalid_request: "No he entendido bien el mensaje. Prueba a escribirlo de otra manera.",
  unauthorized: "Para chatear con ELI hace falta entrar con tu cuenta.",
  network: "No consigo conectar con ELI. Revisa tu conexión e inténtalo de nuevo.",
  interrupted: "Se cortó la conexión con ELI, pero puedes seguir escribiendo.",
};

/** «30 segundos», «1 segundo», «2 minutos»: la espera de un 429 en palabras. */
export function describeWait(seconds: number): string {
  if (seconds >= 90) return `${Math.ceil(seconds / 60)} minutos`;
  const s = Math.max(1, Math.ceil(seconds));
  return s === 1 ? "1 segundo" : `${s} segundos`;
}

function friendlyMessage(code: TutorChatErrorCode, retryAfter?: number): string {
  if (code === "rate_limited" && retryAfter) {
    return `ELI necesita un pequeño descanso. Espera ${describeWait(retryAfter)} y vuelve a intentarlo.`;
  }
  return FRIENDLY_ERRORS[code];
}

function codeFromStatus(status: number): ChatErrorCode {
  switch (status) {
    case 400:
      return "invalid_request";
    case 401:
      return "unauthorized";
    case 429:
      return "rate_limited";
    case 503:
      return "budget_exhausted";
    default:
      return "upstream_error";
  }
}

/** Convierte una respuesta no-2xx (JSON `ChatError` o cualquier otra cosa) en un error amable. */
async function readError(res: Response): Promise<TutorChatError> {
  let body: Partial<ChatError> | null = null;
  try {
    body = (await res.json()) as Partial<ChatError>;
  } catch {
    body = null;
  }
  const code =
    typeof body?.error === "string" && ERROR_CODES.has(body.error)
      ? body.error
      : codeFromStatus(res.status);
  const header = Number(res.headers.get("retry-after"));
  const retryAfter =
    typeof body?.retryAfter === "number"
      ? body.retryAfter
      : Number.isFinite(header) && header > 0
        ? header
        : undefined;
  // El servidor conoce el detalle (por ejemplo, «tu mensaje es muy largo»); su texto tiene prioridad.
  const message =
    typeof body?.message === "string" && body.message.trim()
      ? body.message
      : friendlyMessage(code, retryAfter);
  return retryAfter === undefined ? { code, message } : { code, message, retryAfter };
}

function isAbort(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

function makeUUID(): string {
  const c = globalThis.crypto;
  if (typeof c.randomUUID === "function") return c.randomUUID();
  // Contextos no seguros (por ejemplo, http://192.168.1.5:3000 desde el móvil): uuid v4 a mano.
  const bytes = c.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function defaultStorage(): Pick<Storage, "getItem" | "setItem"> | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null; // Acceso bloqueado (modo privado en algunos navegadores).
  }
}

export function createTutorChat(options: TutorChatOptions = {}): TutorChat {
  const endpoint = options.endpoint ?? CHAT_ENDPOINT;
  const doFetch = options.fetch ?? ((input, init) => fetch(input, init));
  const uuid = options.randomUUID ?? makeUUID;
  const listeners = new Set<() => void>();

  let state: TutorChatState = {
    messages: [],
    status: "idle",
    error: null,
    subject: options.subject,
    meta: null,
  };
  let sessionId: string | null = null;
  let controller: AbortController | null = null;

  const setState = (patch: Partial<TutorChatState>) => {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  };

  const appendTo = (id: string, delta: string) =>
    setState({
      messages: state.messages.map((m) => (m.id === id ? { ...m, content: m.content + delta } : m)),
    });

  const ensureSessionId = (): string => {
    if (sessionId) return sessionId;
    const storage = options.storage === undefined ? defaultStorage() : options.storage;
    let stored: string | null = null;
    try {
      stored = storage?.getItem(SESSION_STORAGE_KEY) ?? null;
    } catch {
      stored = null;
    }
    const id = stored && UUID_RE.test(stored) ? stored : uuid();
    if (id !== stored) {
      try {
        storage?.setItem(SESSION_STORAGE_KEY, id);
      } catch {
        // Sin almacenamiento: la sesión vive mientras dure la página.
      }
    }
    sessionId = id;
    return id;
  };

  /** Un turno: envía `history` (termina en un mensaje de la niña) y acumula la respuesta de ELI. */
  const run = async (history: ChatMessage[]): Promise<boolean> => {
    const assistant: ChatMessage = {
      id: uuid(),
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
    };
    const request: ChatRequest = {
      sessionId: ensureSessionId(),
      messages: history,
      ...(state.subject ? { subject: state.subject } : {}),
    };
    const own = new AbortController();
    controller = own;
    setState({ messages: [...history, assistant], status: "streaming", error: null });

    // Cierra el turno. Si ELI no llegó a decir nada, su burbuja vacía desaparece.
    const finish = (error: TutorChatError | null) => {
      if (controller === own) controller = null;
      const current = state.messages.find((m) => m.id === assistant.id);
      const messages =
        current && current.content === ""
          ? state.messages.filter((m) => m.id !== assistant.id)
          : state.messages;
      setState({ messages, status: error ? "error" : "idle", error });
    };

    let sawText = false;
    try {
      const res = await doFetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "text/plain" },
        body: JSON.stringify(request),
        signal: own.signal,
      });
      if (!res.ok) {
        finish(await readError(res));
        return true;
      }
      setState({
        meta: {
          provider: res.headers.get(CHAT_HEADERS.provider),
          model: res.headers.get(CHAT_HEADERS.model),
        },
      });
      const reader = res.body?.getReader();
      if (!reader) {
        finish({ code: "upstream_error", message: FRIENDLY_ERRORS.upstream_error });
        return true;
      }
      // «Parar» cancela el lector: la lectura pendiente termina con `done` en vez de fallar.
      own.signal.addEventListener("abort", () => void reader.cancel().catch(() => undefined), {
        once: true,
      });
      const decoder = new TextDecoder(); // `stream: true` respeta las tildes partidas entre chunks
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        const delta = decoder.decode(value, { stream: true });
        if (!delta) continue;
        sawText = true;
        appendTo(assistant.id, delta);
      }
      const tail = decoder.decode();
      if (tail) {
        sawText = true;
        appendTo(assistant.id, tail);
      }
      // Un 200 que termina sin texto (ELI «se quedó en blanco») se trata como fallo del proveedor.
      if (sawText || own.signal.aborted) finish(null);
      else finish({ code: "upstream_error", message: FRIENDLY_ERRORS.upstream_error });
    } catch (err) {
      if (own.signal.aborted || isAbort(err)) {
        finish(null);
      } else {
        const code: TutorChatErrorCode = sawText ? "interrupted" : "network";
        finish({ code, message: FRIENDLY_ERRORS[code] });
      }
    }
    return true;
  };

  const send = async (text: string, image?: ChatImage): Promise<boolean> => {
    const content = text.trim();
    if (!content || state.status === "streaming") return false;
    // Una pregunta huérfana (sin respuesta por error o «Parar») se sustituye por la nueva:
    // así el historial siempre alterna niña/ELI, como espera el servidor.
    const last = state.messages.at(-1);
    const base = last?.role === "user" ? state.messages.slice(0, -1) : state.messages;
    const message: ChatMessage = {
      id: uuid(),
      role: "user",
      content,
      createdAt: new Date().toISOString(),
      ...(image ? { image } : {}),
    };
    return run([...base, message]);
  };

  const retry = async (): Promise<boolean> => {
    if (state.status === "streaming" || state.messages.at(-1)?.role !== "user") return false;
    return run(state.messages);
  };

  const loadMessages = (messages: ChatMessage[], subject?: Subject) => {
    setState({ messages, status: "idle", error: null, subject: subject ?? state.subject });
  };

  const newSession = () => {
    controller?.abort();
    sessionId = null;
    // Generar nuevo UUID y guardarlo en storage
    const newId = uuid();
    const storage = options.storage === undefined ? defaultStorage() : options.storage;
    try {
      storage?.setItem(SESSION_STORAGE_KEY, newId);
    } catch {
      // Sin almacenamiento: la sesión vive mientras dure la página.
    }
    setState({ messages: [], status: "idle", error: null, subject: options.subject });
  };

  const getSessionId = (): string => ensureSessionId();

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    send,
    retry,
    stop: () => controller?.abort(),
    setSubject: (subject) => setState({ subject }),
    loadMessages,
    newSession,
    getSessionId,
  };
}

/** «ELI está pensando…»: desde el envío hasta el primer chunk. */
export function isThinking(state: TutorChatState): boolean {
  const last = state.messages.at(-1);
  return state.status === "streaming" && last?.role === "assistant" && last.content === "";
}

/** Hay una pregunta de la niña sin respuesta y no estamos en medio de un turno. */
export function canRetry(state: TutorChatState): boolean {
  return state.status !== "streaming" && state.messages.at(-1)?.role === "user";
}

export function useTutorChat(options?: TutorChatOptions) {
  const [chat] = useState(() => createTutorChat(options));
  const state = useSyncExternalStore(chat.subscribe, chat.getState, chat.getState);
  useEffect(() => () => chat.stop(), [chat]);
  return {
    ...state,
    isThinking: isThinking(state),
    canRetry: canRetry(state),
    send: (text: string, image?: ChatImage) => chat.send(text, image),
    retry: chat.retry,
    stop: chat.stop,
    setSubject: chat.setSubject,
    loadMessages: chat.loadMessages,
    newSession: chat.newSession,
    getSessionId: chat.getSessionId,
  };
}
