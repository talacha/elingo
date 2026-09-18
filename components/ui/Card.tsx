import type { ComponentPropsWithoutRef } from "react";
import { cn } from "./cn";

export type CardVariant = "surface" | "paper" | "note";
type CardTag = "div" | "section" | "article" | "aside" | "figure";

const variants: Record<CardVariant, string> = {
  /** Tarjeta blanca sobre el fondo crema; sigue el tema del sistema. */
  surface: "rounded-card border border-line bg-surface text-ink shadow-card",
  /** Objeto "de papel": conserva su color claro también en modo oscuro. */
  paper: "rounded-[14px] bg-paper text-paper-ink shadow-card",
  /** Nota adhesiva amarilla, con la tipografía de títulos. */
  note: "rounded-[4px] bg-note font-display font-medium text-paper-ink shadow-card",
};

export type CardProps = ComponentPropsWithoutRef<"div"> & {
  variant?: CardVariant;
  /** Etiqueta HTML que se renderiza (por defecto `div`). */
  as?: CardTag;
  /** Relleno interior fluido (`p-card`). Desactívalo para controlar el relleno por secciones. */
  padded?: boolean;
};

export function Card({
  variant = "surface",
  as: Tag = "div",
  padded = true,
  className,
  ...props
}: CardProps) {
  return <Tag {...props} className={cn(variants[variant], padded && "p-card", className)} />;
}
