import type { ReactNode } from "react";
import { EliMark } from "@/components/landing/EliMark";
import { Card } from "@/components/ui/Card";

function KidBubble({ children }: { children: ReactNode }) {
  return (
    <p className="max-w-[85%] justify-self-end rounded-bubble rounded-br-md bg-kid px-4 py-[0.7em] text-[1.02rem] leading-[1.45] text-ink">
      {children}
    </p>
  );
}

function EliBubble({ children }: { children: ReactNode }) {
  return (
    <div className="grid max-w-[92%] grid-cols-[34px_1fr] items-end gap-2.5 justify-self-start">
      <span
        aria-hidden="true"
        className="grid size-[34px] place-items-center rounded-full bg-surface-2"
      >
        <EliMark className="size-[22px]" />
      </span>
      <p className="rounded-bubble rounded-bl-md bg-surface-2 px-4 py-[0.7em] text-[1.02rem] leading-[1.45] text-ink">
        {children}
      </p>
    </div>
  );
}

/** Ejemplo estático de una plática con ELI. Anticipa el estilo de burbujas que T-014 hará real. */
export function ChatPreview() {
  return (
    <Card
      as="figure"
      padded={false}
      aria-label="Ejemplo de una plática con ELI"
      className="grid overflow-hidden"
    >
      <div className="flex items-center gap-2.5 border-b border-line px-[18px] py-3.5 font-display text-[0.95rem] font-semibold text-ink-soft">
        <span aria-hidden="true" className="size-2.5 rounded-full bg-leaf" />
        <span>Plática con ELI</span>
      </div>
      <div className="grid gap-3 p-[18px]">
        <KidBubble>Tengo este problema: 24 + 18. Me trabé.</KidBubble>
        <EliBubble>
          ¡Buen intento por empezar! Vamos paso a paso.{" "}
          <strong>¿Qué dos números vamos a sumar?</strong>
        </EliBubble>
        <KidBubble>El 24 y el 18.</KidBubble>
        <EliBubble>
          Muy bien. Mira primero el <strong>4</strong> y el <strong>8</strong>. ¿Cuánto es 4 + 8?
        </EliBubble>
      </div>
      <div
        aria-hidden="true"
        className="mx-[18px] mb-3.5 flex items-center justify-between gap-3 rounded-full border-2 border-dashed border-line py-[0.55em] pr-[0.55em] pl-[1.1em] text-base text-ink-soft"
      >
        <span>Escribe aquí…</span>
        <span className="grid size-9 place-items-center rounded-full bg-sun text-paper-ink">
          <svg
            viewBox="0 0 24 24"
            className="size-[18px]"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 12 20 4l-6 16-3-7z" />
            <path d="M11 13l9-9" />
          </svg>
        </span>
      </div>
      <figcaption className="px-[18px] pb-4 text-[0.9rem] text-ink-soft">
        Así se ve una plática con ELI.
      </figcaption>
    </Card>
  );
}
