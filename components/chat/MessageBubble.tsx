import { EliMark } from "@/components/landing/EliMark";
import { cn } from "@/components/ui/cn";
import { Markdown } from "./Markdown";
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

interface MessageBubbleProps {
  message: ChatMessage;
  /** La respuesta de ELI aún está llegando (muestra el cursor). */
  streaming?: boolean;
}

export function MessageBubble({ message, streaming = false }: MessageBubbleProps) {
  if (message.role === "user") {
    return (
      <li className="flex justify-end">
        <p className={cn(bubble, "m-0 max-w-[85%] rounded-br-md bg-kid text-ink whitespace-pre-wrap")}>
          <span className="sr-only">Tú: </span>
          {message.content}
        </p>
      </li>
    );
  }
  return (
    <li className="grid max-w-[92%] grid-cols-[34px_1fr] items-end gap-2.5 justify-self-start">
      <EliAvatar />
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
    </li>
  );
}
