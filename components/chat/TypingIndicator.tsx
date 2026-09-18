import { EliAvatar } from "./MessageBubble";

/** «ELI está pensando…»: visible desde que se envía el mensaje hasta que llega el primer chunk. */
export function TypingIndicator() {
  return (
    <li className="grid max-w-[92%] grid-cols-[34px_1fr] items-end gap-2.5 justify-self-start">
      <EliAvatar />
      <p
        role="status"
        className="m-0 inline-flex w-fit items-center gap-2 rounded-bubble rounded-bl-md bg-surface-2 px-4 py-[0.7em] text-ink-soft"
      >
        ELI está pensando…
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
