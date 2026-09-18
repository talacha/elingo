import { cn } from "@/components/ui/cn";
import { EliAvatar } from "./MessageBubble";

interface SystemMessageProps {
  model: string | null;
  className?: string;
}

/** Burbuja de sistema al inicio del chat mostrando el modelo activo. */
export function SystemMessage({ model, className }: SystemMessageProps) {
  const displayModel = model ?? "desconocido";

  return (
    <li
      className={cn(
        "grid max-w-[92%] grid-cols-[34px_1fr] items-end gap-2.5 justify-self-start animate-fade-in motion-reduce:animate-none",
        className,
      )}
    >
      <EliAvatar />
      <div className="rounded-bubble rounded-bl-md bg-surface-2/50 px-4 py-[0.7em] text-sm text-ink-soft">
        <p className="m-0">
          <span className="sr-only">ELI: </span>
          Hola, soy ELI. Modelo activo: <strong>{displayModel}</strong>
        </p>
      </div>
    </li>
  );
}
