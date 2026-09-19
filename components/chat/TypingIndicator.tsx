"use client";

import { useEffect, useState } from "react";
import { EliAvatar } from "./MessageBubble";
import { nextPhraseIndex, PHRASE_INTERVAL_MS, THINKING_PHRASES } from "./thinkingPhrases";

/**
 * «ELI está pensando…»: visible desde que se envía el mensaje hasta que llega el primer texto.
 * Empieza con esa frase y, si la respuesta tarda, va cambiando de frase (breves, para una niña)
 * con una entrada suave y un brillo que recorre el texto, como el texto animado de Claude.
 *
 * Accesibilidad: el lector de pantalla lee UNA vez «ELI está pensando» (el texto oculto es fijo); las
 * frases que rotan son decorativas (`aria-hidden`), para no anunciar un cambio cada pocos segundos.
 * Con «reducir movimiento» las frases siguen cambiando, pero sin desplazamiento ni brillo.
 */
export function TypingIndicator() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((current) => nextPhraseIndex(current, THINKING_PHRASES.length));
    }, PHRASE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  const phrase = THINKING_PHRASES[index] ?? THINKING_PHRASES[0];

  return (
    <li className="grid max-w-[92%] grid-cols-[34px_1fr] items-end gap-2.5 justify-self-start">
      <EliAvatar />
      <p
        role="status"
        className="m-0 inline-flex w-fit items-center gap-2 rounded-bubble rounded-bl-md bg-surface-2 px-4 py-[0.7em] text-ink-soft"
      >
        <span className="sr-only">ELI está pensando</span>
        {/* `key` remonta el span en cada frase: así se repite la animación de entrada */}
        <span key={index} aria-hidden="true" className="inline-flex items-center gap-1.5 animate-phrase-in motion-reduce:animate-none">
          {phrase.emoji && <span>{phrase.emoji}</span>}
          <span className="animate-shimmer bg-[linear-gradient(90deg,var(--color-ink-soft)_35%,var(--color-ink)_50%,var(--color-ink-soft)_65%)] bg-[length:200%_100%] bg-clip-text text-transparent motion-reduce:animate-none motion-reduce:bg-none motion-reduce:text-ink-soft">
            {phrase.text}
          </span>
        </span>
        <span aria-hidden="true" className="flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="size-1.5 animate-bounce rounded-full bg-sky motion-reduce:animate-none"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </span>
      </p>
    </li>
  );
}
