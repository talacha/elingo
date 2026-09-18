import { EliMark } from "@/components/landing/EliMark";
import { cn } from "@/components/ui/cn";
import { Markdown } from "./Markdown";
import { useSpeechOutput } from "./useSpeechOutput";
import type { ChatMessage } from "@/lib/contracts/chat";

/** Avatar de ELI junto a sus burbujas. Decorativo: el texto oculto «ELI:» ya identifica al autor. */
export function EliAvatar({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-[34px] shrink-0 place-items-center rounded-full bg-surface-2 shadow-lift",
        className,
      )}
    >
      <EliMark className="size-[22px]" />
    </span>
  );
}

const bubble =
  "rounded-bubble px-4 py-[0.7em] leading-[1.45] [overflow-wrap:anywhere]";

function SpeakerIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-4"
      fill="currentColor"
    >
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.26 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
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

interface MessageBubbleProps {
  message: ChatMessage;
  /** La respuesta de ELI aún está llegando (muestra el cursor). */
  streaming?: boolean;
}

export function MessageBubble({ message, streaming = false }: MessageBubbleProps) {
  const speechOutput = useSpeechOutput();

  if (message.role === "user") {
    return (
      <li className="flex justify-end animate-fade-in motion-reduce:animate-none">
        <div className="grid max-w-[85%] justify-items-end gap-1.5">
          {message.image && (
            <img
              src={`data:${message.image.mediaType};base64,${message.image.data}`}
              alt="Foto que adjuntaste"
              className="h-24 w-24 rounded-bubble object-cover shadow-card"
            />
          )}
          <p className={cn(bubble, "m-0 rounded-br-md bg-kid text-ink whitespace-pre-wrap")}>
            <span className="sr-only">Tú: </span>
            {message.content}
          </p>
        </div>
      </li>
    );
  }

  const canSpeak = !streaming && message.content && speechOutput.available;

  return (
    <li className="grid max-w-[92%] grid-cols-[34px_1fr] items-end gap-2.5 justify-self-start animate-fade-in motion-reduce:animate-none">
      <EliAvatar />
      <div className="flex flex-col gap-2">
        <div
          aria-busy={streaming || undefined}
          className={cn(bubble, "m-0 rounded-bl-md bg-surface-2 text-ink")}
        >
          <span className="sr-only">ELI: </span>
          <Markdown content={message.content} className="space-y-1.5" />
          {streaming && (
            <span
              aria-hidden="true"
              className="ml-0.5 inline-block h-[1em] w-[0.5ch] translate-y-[0.15em] animate-pulse rounded-sm bg-ink-soft motion-reduce:animate-none"
            />
          )}
        </div>
        {canSpeak && (
          <button
            onClick={() =>
              speechOutput.status === "idle"
                ? speechOutput.speak(message.content)
                : speechOutput.stop()
            }
            aria-label={
              speechOutput.status === "idle" ? "Escuchar" : "Detener"
            }
            className="flex items-center gap-1.5 self-start rounded-full px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-surface-3 active:bg-surface-3"
          >
            {speechOutput.status === "idle" ? (
              <>
                <SpeakerIcon />
                <span>Escuchar</span>
              </>
            ) : (
              <>
                <StopIcon />
                <span>Detener</span>
              </>
            )}
          </button>
        )}
      </div>
    </li>
  );
}
