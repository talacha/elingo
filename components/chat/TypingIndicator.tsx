"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { EliAvatar } from "./MessageBubble";
import { nextPhraseIndex, PHRASE_INTERVAL_MS, THINKING_PHRASES } from "./thinkingPhrases";
import { BLINK_COUNT, BLINK_CYCLE_MS, delayFor, INITIAL_STATE, step, type TypewriterState } from "./typewriter";

const LENGTHS = THINKING_PHRASES.map((phrase) => phrase.text.length);
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const prefersReducedMotion = () => window.matchMedia(REDUCED_MOTION).matches;

/**
 * «ELI está pensando…»: visible desde que se envía el mensaje hasta que llega el primer texto.
 * Escribe una frase amable letra a letra con un cursor, lo deja parpadear 3 veces, la borra rápido y
 * escribe la siguiente (la lógica está en `typewriter.ts`).
 *
 * Accesibilidad: el lector de pantalla lee UNA vez «ELI está pensando» (el texto oculto es fijo); lo que se
 * escribe es decorativo (`aria-hidden`), para no anunciar cada letra. Con «reducir movimiento» no se
 * escribe ni se borra: la frase aparece entera, el cursor queda quieto y las frases cambian cada pocos segundos.
 */
export function TypingIndicator() {
  const [state, setState] = useState<TypewriterState>(INITIAL_STATE);
  const reduced = useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, () => false);

  useEffect(() => {
    if (reduced) {
      const timer = setInterval(() => {
        setState((s) => ({ ...s, index: nextPhraseIndex(s.index, THINKING_PHRASES.length) }));
      }, PHRASE_INTERVAL_MS);
      return () => clearInterval(timer);
    }
    const timer = setTimeout(() => setState((s) => step(s, LENGTHS)), delayFor(state.phase));
    return () => clearTimeout(timer);
  }, [state, reduced]);

  const phrase = THINKING_PHRASES[state.index] ?? THINKING_PHRASES[0];
  const text = reduced ? phrase.text : phrase.text.slice(0, state.shown);
  const blinking = state.phase === "holding" && !reduced;

  return (
    <li className="grid max-w-[92%] grid-cols-[34px_1fr] items-end gap-2.5 justify-self-start">
      <EliAvatar />
      <p
        role="status"
        className="m-0 inline-flex w-fit items-center rounded-bubble rounded-bl-md bg-surface-2 px-4 py-[0.7em] text-ink-soft"
      >
        <span className="sr-only">ELI está pensando</span>
        <span aria-hidden="true" className="inline-flex items-center">
          {phrase.emoji && text.length > 0 && <span className="mr-1.5">{phrase.emoji}</span>}
          <span>{text}</span>
          {/* `key` reinicia el parpadeo en cada frase; la duración y las repeticiones vienen de `typewriter.ts` */}
          <span
            key={blinking ? state.index : "steady"}
            className={`ml-0.5 h-[1.15em] w-0.5 rounded-full bg-sky ${blinking ? "animate-cursor-blink" : ""}`}
            style={blinking ? { animationDuration: `${BLINK_CYCLE_MS}ms`, animationIterationCount: BLINK_COUNT } : undefined}
          />
        </span>
      </p>
    </li>
  );
}
