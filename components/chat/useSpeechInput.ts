"use client";

import { useEffect, useRef, useState } from "react";

export type SpeechInputStatus = "idle" | "listening" | "transcribing" | "unsupported";

export interface UseSpeechInputResult {
  status: SpeechInputStatus;
  /** Texto provisional mientras se dicta (solo con SpeechRecognition nativo). */
  interimText: string;
  /** Aviso amable si algo falló. */
  error: string | null;
  start(): void;
  stop(): void;
}

/** Forma mínima de SpeechRecognition/webkitSpeechRecognition (no estándar, sin tipos en lib.dom). */
interface SpeechRecognitionResultItem {
  readonly transcript: string;
  readonly isFinal: boolean;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResultItem;
}
interface SpeechRecognitionEvent {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}
interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

/** Único punto de acceso al global no estándar, con un cast preciso (nunca `any`). */
function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function hasMediaRecorderSupport(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

const UNAVAILABLE_MESSAGE = "La entrada por voz no está disponible ahora mismo. Puedes escribir tu pregunta.";
const NO_MIC_MESSAGE = "No he podido oírte bien. Puedes escribir tu pregunta.";

/**
 * Hook que captura la voz del usuario con mejora progresiva:
 * 1. SpeechRecognition nativo si está disponible (sin backend, sin coste).
 * 2. MediaRecorder + /api/transcribe si no.
 * 3. "unsupported" si nada funciona (el llamador oculta el botón de micrófono).
 *
 * El texto final se pasa a `onResult` para que la alumna lo revise antes de enviar — nunca se
 * envía solo.
 */
export function useSpeechInput(onResult: (text: string) => void): UseSpeechInputResult {
  const [status, setStatus] = useState<SpeechInputStatus>("unsupported");
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Deteta la capacidad del navegador tras montar: en el servidor `window` no existe, así que
    // el primer render (SSR e hidratación) siempre parte de "unsupported" sin desajustes.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sondeo de una capacidad externa (no reactiva a props/estado), solo posible tras montar
    setStatus(getSpeechRecognitionCtor() || hasMediaRecorderSupport() ? "idle" : "unsupported");
  }, []);

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const transcribeAudio = async (blob: Blob, mimeType: string) => {
    try {
      // Convierte a base64 sin el prefijo data:, en trozos: pasar el array completo a
      // String.fromCharCode (apply o spread) puede desbordar el límite de argumentos del motor
      // JS en grabaciones de más de unos segundos.
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const CHUNK_SIZE = 8192;
      let binary = "";
      for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
        binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE));
      }
      const audio = btoa(binary);

      const response = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ audio, mimeType }),
      });

      if (response.status === 200) {
        const data = (await response.json()) as { text: string };
        onResult(data.text);
      } else {
        setError(UNAVAILABLE_MESSAGE);
      }
    } catch {
      setError(UNAVAILABLE_MESSAGE);
    } finally {
      setStatus("idle");
      setInterimText("");
      stopTracks();
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstart = () => {
        setStatus("listening");
        setError(null);
        setInterimText("");
      };
      recorder.onstop = () => {
        setStatus("transcribing");
        const blob = new Blob(audioChunksRef.current, { type: mimeType || "audio/webm" });
        void transcribeAudio(blob, mimeType || "audio/webm");
      };

      recorder.start();
    } catch {
      setError("No tengo permiso de micrófono. Puedes escribir tu pregunta.");
      setStatus("idle");
    }
  };

  const start = () => {
    if (status === "unsupported") return;
    const SpeechRecognitionCtor = getSpeechRecognitionCtor();

    if (SpeechRecognitionCtor) {
      try {
        const recognition = new SpeechRecognitionCtor();
        recognition.lang = "es-ES";
        recognition.continuous = false;
        recognition.interimResults = true;

        recognition.onstart = () => {
          setStatus("listening");
          setError(null);
          setInterimText("");
        };

        recognition.onresult = (event) => {
          let interim = "";
          let finalTranscript: string | null = null;
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            if (result?.isFinal) finalTranscript = result.transcript;
            else interim += result?.transcript ?? "";
          }
          if (finalTranscript !== null) {
            onResult(finalTranscript);
            setInterimText("");
            setStatus("idle");
          } else {
            setInterimText(interim);
          }
        };

        recognition.onerror = () => {
          setError(NO_MIC_MESSAGE);
          setStatus("idle");
          setInterimText("");
        };

        recognition.onend = () => {
          // No lee `status`: onresult/onerror ya ponen "idle" cuando corresponde; esto es el
          // respaldo para cuando termina sin resultado ni error (p.ej. se soltó enseguida).
          setStatus("idle");
          setInterimText("");
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch {
        setError(NO_MIC_MESSAGE);
        setStatus("idle");
      }
    } else if (hasMediaRecorderSupport()) {
      void startRecording();
    }
  };

  const stop = () => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // Ya se había detenido; no hay nada que hacer.
    }
    // Stop the mediaRecorder if it exists, regardless of current status to avoid
    // stale closure issues: this is called synchronously from event handlers,
    // so set idle state immediately to prevent button lingering in "listening".
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    // Set idle and clear interim immediately; onend/onstop handlers will also set it
    // (idempotent). This prevents UI from lingering in "listening" if handlers fire late.
    setStatus("idle");
    setInterimText("");
    stopTracks();
  };

  // Cleanup on unmount: stop any in-progress recording/recognition.
  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        // Already stopped.
      }
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
      stopTracks();
    };
  }, []);

  return { status, interimText, error, start, stop };
}
