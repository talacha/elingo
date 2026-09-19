"use client";

import { useEffect, useRef, type ReactNode, type UIEvent } from "react";
import { cn } from "@/components/ui/cn";
import type { ChatMessage } from "@/lib/contracts/chat";
import { MessageBubble } from "./MessageBubble";
import { SystemMessage } from "./SystemMessage";
import { TypingIndicator } from "./TypingIndicator";

interface MessageListProps {
  messages: ChatMessage[];
  streaming: boolean;
  thinking: boolean;
  /** Se muestra encima de la lista (por ejemplo, la bienvenida cuando aún no hay mensajes). */
  intro?: ReactNode;
  /** Modelo actual a mostrar en el mensaje de sistema. */
  model?: string | null;
  /** Id de la respuesta de ELI que debe leerse en voz alta (la pregunta fue hablada). */
  autoSpeakId?: string | null;
  className?: string;
}

/** Si la niña está a menos de esta distancia del final, la lista la sigue mientras ELI escribe. */
const NEAR_BOTTOM_PX = 120;

export function MessageList({
  messages,
  streaming,
  thinking,
  intro,
  model,
  autoSpeakId,
  className,
}: MessageListProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const seenCount = useRef(0);

  // La burbuja vacía de ELI no se pinta: en su lugar está el indicador de «pensando».
  const visible = messages.filter((m) => !(m.role === "assistant" && m.content === ""));
  const lastLength = visible.at(-1)?.content.length ?? 0;

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (messages.length !== seenCount.current) {
      seenCount.current = messages.length;
      stickToBottom.current = true; // Un mensaje nuevo siempre lleva al final.
    }
    if (stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages.length, lastLength, thinking]);

  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
  };

  return (
    <div
      ref={scrollerRef}
      onScroll={onScroll}
      className={cn("overflow-y-auto overscroll-contain", className)}
    >
      <div className="mx-auto w-full max-w-3xl px-gutter py-4">
        {intro}
        <ol
          role="log"
          aria-label="Conversación con ELI"
          aria-live="polite"
          aria-atomic="false"
          className="grid gap-3"
        >
          {model && <SystemMessage model={model} />}
          {visible.map((message, i) => (
            <MessageBubble
              key={message.id}
              message={message}
              streaming={streaming && i === visible.length - 1 && message.role === "assistant"}
              autoSpeak={message.id === autoSpeakId}
            />
          ))}
          {thinking && <TypingIndicator />}
        </ol>
      </div>
    </div>
  );
}
