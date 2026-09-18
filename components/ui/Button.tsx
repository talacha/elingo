import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-display font-semibold whitespace-nowrap transition-[background-color,border-color,translate] duration-150 ease-out hover:-translate-y-px motion-reduce:transition-none motion-reduce:hover:translate-y-0 disabled:pointer-events-none disabled:opacity-60";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary shadow-lift hover:bg-primary-deep",
  secondary: "border-2 border-line bg-surface text-ink hover:border-sky",
  ghost: "text-ink underline decoration-sun decoration-2 underline-offset-4 hover:bg-surface-2",
};

// Altura mínima de 44 px: objetivo táctil cómodo para una niña en el móvil.
const sizes: Record<ButtonSize, string> = {
  md: "min-h-11 px-[1.15em] py-[0.6em] text-base",
  lg: "min-h-13 px-7 py-3 text-lg",
};

type Common = { variant?: ButtonVariant; size?: ButtonSize; className?: string };

type AnchorProps = Common & { href: string } & Omit<
    ComponentPropsWithoutRef<typeof Link>,
    "href" | "className"
  >;

type NativeProps = Common & Omit<ComponentPropsWithoutRef<"button">, "className">;

export type ButtonProps = AnchorProps | NativeProps;

/** Botón de ELI. Con `href` renderiza un enlace (next/link); sin él, un `<button type="button">`. */
export function Button({ variant = "primary", size = "md", className, ...props }: ButtonProps) {
  const classes = cn(base, variants[variant], sizes[size], className);
  if ("href" in props) {
    return <Link {...props} className={classes} />;
  }
  return <button type="button" {...props} className={classes} />;
}
