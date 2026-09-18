"use client";

import { useEffect, useRef, useState } from "react";

export type SpeechOutputStatus = "idle" | "loading" | "speaking";

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

  // Determinar disponibilidad
  const available =
    typeof Audio !== "undefined" ||
    (typeof window !== "undefined" && "speechSynthesis" in window);

  const stop = () => {
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

    // Intentar usar la API de síntesis
    fetch("/api/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    })
      .then(async (response) => {
        if (!response.ok || response.status !== 200) {
          // 204 o cualquier otro status: usar fallback
          return speakWithBrowserSynthesis(text);
        }

        // Intentar leer el cuerpo como blob
        const blob = await response.blob();
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
