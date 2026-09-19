"use client";

import { useEffect, useRef, useState } from "react";

export type SpeechOutputStatus = "idle" | "loading" | "speaking";

const STOP_SPEECH_EVENT = "eli:stop-speech";

/**
 * Corta cualquier voz de ELI que esté sonando o cargándose, sea de la burbuja que sea. Se llama al
 * activar el micrófono (para que la voz de ELI no entre como si fuera la pregunta de la niña) y al
 * enviar un mensaje nuevo.
 */
export function stopAllSpeech(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(STOP_SPEECH_EVENT));
}

export interface UseSpeechOutputResult {
  status: SpeechOutputStatus;
  /** true si hay alguna vía de voz disponible (API o fallback del navegador) — casi siempre true. */
  available: boolean;
  speak(text: string): void;
  stop(): void;
}

export function useSpeechOutput(): UseSpeechOutputResult {
  const [status, setStatus] = useState<SpeechOutputStatus>("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const urlRef = useRef<string | null>(null);
  /** Generación de la petición de voz en curso: `stop()` la invalida y la respuesta tardía no suena. */
  const generationRef = useRef(0);

  // Determinar disponibilidad
  const available =
    typeof Audio !== "undefined" ||
    (typeof window !== "undefined" && "speechSynthesis" in window);

  const stop = () => {
    generationRef.current += 1;

    // Detener reproducción de audio si existe
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    // Cancelar síntesis de voz del navegador
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis?.cancel();
    }

    // Limpiar URL del objeto
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }

    setStatus("idle");
  };

  const speak = (text: string) => {
    // Si ya está hablando, detener primero (toggle behavior)
    if (status === "speaking" || status === "loading") {
      stop();
      return;
    }

    setStatus("loading");
    const generation = ++generationRef.current;
    const cancelled = () => generation !== generationRef.current;

    // Intentar usar la API de síntesis
    fetch("/api/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    })
      .then(async (response) => {
        if (cancelled()) return;
        if (!response.ok || response.status !== 200) {
          // 204 o cualquier otro status: usar fallback
          return speakWithBrowserSynthesis(text);
        }

        // Intentar leer el cuerpo como blob
        const blob = await response.blob();
        if (cancelled()) return;
        if (blob.size === 0) {
          // Blob vacío, usar fallback
          return speakWithBrowserSynthesis(text);
        }

        // Reproducir el audio
        const url = URL.createObjectURL(blob);
        urlRef.current = url;

        const audio = new Audio(url);
        audioRef.current = audio;

        audio.onplay = () => {
          setStatus("speaking");
        };

        audio.onended = () => {
          setStatus("idle");
          if (urlRef.current) {
            URL.revokeObjectURL(urlRef.current);
            urlRef.current = null;
          }
        };

        audio.onerror = () => {
          setStatus("idle");
          if (urlRef.current) {
            URL.revokeObjectURL(urlRef.current);
            urlRef.current = null;
          }
        };

        audio.play().catch(() => {
          // Si falla la reproducción, usar fallback
          setStatus("idle");
          if (urlRef.current) {
            URL.revokeObjectURL(urlRef.current);
            urlRef.current = null;
          }
          speakWithBrowserSynthesis(text);
        });
      })
      .catch(() => {
        // Error de red: usar fallback
        if (cancelled()) return;
        speakWithBrowserSynthesis(text);
      });
  };

  // No es un hook (no llama a otros hooks): el nombre no empieza por "use" para no chocar con
  // la regla react-hooks/rules-of-hooks, que trata cualquier función "use*" como hook.
  const speakWithBrowserSynthesis = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setStatus("idle");
      return;
    }

    // Cancelar cualquier síntesis previa
    window.speechSynthesis?.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "es-ES";

    utterance.onstart = () => {
      setStatus("speaking");
    };

    utterance.onend = () => {
      setStatus("idle");
    };

    utterance.onerror = () => {
      setStatus("idle");
    };

    utteranceRef.current = utterance;
    window.speechSynthesis?.speak(utterance);
  };

  // Atiende `stopAllSpeech()`. `stop` solo toca refs y `setStatus` (estables), así que la versión de
  // esta clausura vale para siempre.
  useEffect(() => {
    const onStop = () => stop();
    window.addEventListener(STOP_SPEECH_EVENT, onStop);
    return () => window.removeEventListener(STOP_SPEECH_EVENT, onStop);
  }, []);

  // Detiene cualquier audio o síntesis al desmontar. No usa stop()/status: esta clausura es la
  // del montaje (status siempre sería "idle" aquí), así que actúa directo sobre los refs.
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis?.cancel();
      }
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, []);

  return {
    status,
    available,
    speak,
    stop,
  };
}
