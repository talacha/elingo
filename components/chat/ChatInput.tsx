"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import type { Subject } from "@/lib/contracts/chat";

/** Límite de entrada del servidor (`AI_MAX_INPUT_CHARS`, tasks.md 6.6). */
export const MAX_INPUT_CHARS = 1000;
export const INPUT_PLACEHOLDER = "Tengo este problema: … me trabé en …";

const SUBJECT_PLACEHOLDERS: Record<Subject, string> = {
  mates: "Tengo este problema de mates: … me trabé en …",
  lengua: "Tengo esta duda de lengua: … no sé bien…",
  ciencias: "Tengo esta pregunta de ciencias: … no entiendo bien…",
};

interface ChatInputProps {
  /** ELI está respondiendo: se ofrece «Parar» en vez de «Enviar». */
  streaming: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  /** Asignatura seleccionada, para personalizar el placeholder. */
  subject?: Subject;
}

function SendIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 12 20 4l-6 16-3-7z" />
      <path d="M11 13l9-9" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4" fill="currentColor">
      <rect x="5" y="5" width="14" height="14" rx="3" />
    </svg>
  );
}

export function ChatInput({ streaming, onSend, onStop, subject }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSend = value.trim().length > 0 && !streaming;
  const placeholder = subject ? SUBJECT_PLACEHOLDERS[subject] : INPUT_PLACEHOLDER;

  // El área de texto crece con el mensaje hasta unas seis líneas; después hace scroll interno.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [value]);

  const submit = () => {
    const text = value.trim();
    if (!text || streaming) return;
    onSend(text);
    setValue("");
    // Restaurar el foco al input después de enviar
    textareaRef.current?.focus();
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit();
  };

  // Enter envía; Shift+Enter salta de línea. Durante la composición (teclados IME) no se envía.
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <form onSubmit={onSubmit} className="grid gap-1.5">
      <div className="flex items-end gap-2 rounded-[26px] border-2 border-line bg-surface p-1.5 pl-4 shadow-card transition-colors focus-within:border-sky motion-reduce:transition-none">
        <label htmlFor="chat-input" className="sr-only">
          Escribe tu mensaje para ELI
        </label>
        <textarea
          id="chat-input"
          ref={textareaRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          maxLength={MAX_INPUT_CHARS}
          placeholder={placeholder}
          autoComplete="off"
          enterKeyHint="send"
          aria-label="Escribe tu mensaje para ELI"
          className="min-h-11 flex-1 resize-none bg-transparent py-2.5 text-ink outline-none placeholder:text-ink-soft"
        />
        {streaming ? (
          <Button variant="secondary" onClick={onStop} className="shrink-0">
            <StopIcon />
            Parar
          </Button>
        ) : (
          <button
            type="submit"
            disabled={!canSend}
            aria-label="Enviar"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-on-primary shadow-lift transition-[background-color,translate] duration-150 ease-out hover:-translate-y-px hover:bg-primary-deep disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            <SendIcon />
          </button>
        )}
      </div>
      <p className="m-0 flex min-h-5 justify-between gap-3 px-4 text-[0.85rem] text-ink-soft">
        <span className="hidden md:inline">Enter envía · Shift+Enter, nueva línea</span>
        {value.length >= MAX_INPUT_CHARS - 200 && (
          <span
            aria-live="polite"
            className={cn("ml-auto", value.length >= MAX_INPUT_CHARS && "font-bold text-peach")}
          >
            {value.length}/{MAX_INPUT_CHARS}
          </span>
        )}
      </p>
    </form>
  );
}
