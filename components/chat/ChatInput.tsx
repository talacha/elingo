"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import type { Subject, ImageMimeType } from "@/lib/contracts/chat";
import type { ChatCapabilities } from "@/app/api/chat/capabilities/route";
import { useSpeechInput } from "./useSpeechInput";
import { compressImageFile } from "./imageCompress";

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
  onSend: (text: string, image?: { mediaType: ImageMimeType; data: string }) => void;
  onStop: () => void;
  /** Asignatura seleccionada, para personalizar el placeholder. */
  subject?: Subject;
  /** User capabilities (images, voice, text) from parent. Optional, defaults to all-true. */
  capabilities?: ChatCapabilities;
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

function MicIcon() {
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
      <path d="M12 2c-1.104 0-2 .896-2 2v8c0 1.104.896 2 2 2s2-.896 2-2V4c0-1.104-.896-2-2-2z" />
      <path d="M7 12a5 5 0 0 0 10 0" />
      <path d="M12 18v3" />
      <path d="M9 21h6" />
    </svg>
  );
}

function CameraIcon() {
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
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

export function ChatInput({
  streaming,
  onSend,
  onStop,
  subject,
  capabilities = { allowImages: true, allowVoice: true, allowText: true },
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [image, setImage] = useState<{ mediaType: ImageMimeType; data: string } | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canSend = value.trim().length > 0 && !streaming;
  const placeholder = subject ? SUBJECT_PLACEHOLDERS[subject] : INPUT_PLACEHOLDER;

  const speechInput = useSpeechInput((text) => {
    setValue(text);
  });

  // El área de texto crece con el mensaje hasta unas seis líneas; después hace scroll interno.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [value]);

  const handleImageSelect = async (file: File) => {
    setImageError(null);
    try {
      const compressed = await compressImageFile(file);
      setImage(compressed);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al procesar la foto";
      setImageError(message);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      void handleImageSelect(file);
    }
    // Resetea el input para permitir seleccionar el mismo archivo otra vez
    event.target.value = "";
  };

  const submit = () => {
    const text = value.trim();
    if (!text || streaming) return;
    onSend(text, image ?? undefined);
    setValue("");
    setImage(null);
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
      {/* Previsualización de imagen */}
      {image && (
        <div className="flex items-center gap-2 rounded-card border-2 border-line bg-surface p-2 pl-3 shadow-card">
          <img
            src={`data:${image.mediaType};base64,${image.data}`}
            alt="Foto adjunta"
            className="h-12 w-12 rounded object-cover"
          />
          <button
            type="button"
            onClick={() => setImage(null)}
            aria-label="Quitar foto"
            className="ml-auto inline-flex items-center justify-center size-6 text-ink-soft hover:text-ink transition-colors"
          >
            ×
          </button>
        </div>
      )}

      {/* Errores de voz e imagen */}
      {(speechInput.error || imageError) && (
        <div className="rounded-card border-2 border-peach bg-surface px-3 py-2 text-[0.85rem] text-peach">
          {speechInput.error || imageError}
        </div>
      )}

      <div className="flex min-w-0 items-end gap-2 rounded-[26px] border-2 border-line bg-surface p-1.5 pl-4 shadow-card transition-colors focus-within:border-sky motion-reduce:transition-none">
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
          className="min-h-11 min-w-0 flex-1 resize-none bg-transparent py-2.5 text-ink outline-none placeholder:text-ink-soft"
        />

        {/* Botón de micrófono */}
        {speechInput.status !== "unsupported" && capabilities.allowVoice && (
          <button
            type="button"
            disabled={streaming}
            onMouseDown={() => speechInput.start()}
            onMouseUp={() => speechInput.stop()}
            onMouseLeave={() => speechInput.stop()}
            onTouchStart={() => speechInput.start()}
            onTouchEnd={() => speechInput.stop()}
            aria-label="Grabar voz"
            className={cn(
              "grid size-11 shrink-0 place-items-center rounded-full text-on-primary shadow-lift transition-[background-color,translate] duration-150 ease-out hover:-translate-y-px motion-reduce:transition-none motion-reduce:hover:translate-y-0",
              speechInput.status === "listening" ? "bg-peach hover:bg-peach-deep" : "bg-surface-2 hover:bg-surface-3 text-ink",
              "disabled:pointer-events-none disabled:opacity-50",
            )}
          >
            <MicIcon />
          </button>
        )}

        {/* Botón de cámara */}
        {capabilities.allowImages && (
          <button
            type="button"
            disabled={streaming}
            onClick={() => fileInputRef.current?.click()}
            aria-label="Adjuntar foto"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-2 text-ink shadow-lift transition-[background-color,translate] duration-150 ease-out hover:-translate-y-px hover:bg-surface-3 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            <CameraIcon />
          </button>
        )}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
          aria-hidden="true"
        />

        {/* Botón de envío o parada */}
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
