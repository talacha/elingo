/** Une clases ignorando valores falsos. Suficiente para nuestros componentes sin depender de clsx. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
