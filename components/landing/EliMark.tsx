/** Logotipo pequeño de ELI: la lucecita con su base. Decorativo (aria-hidden). */
export function EliMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" className={className}>
      <circle className="fill-sun" cx="16" cy="12" r="10" />
      <rect className="fill-sun" x="11" y="19" width="10" height="5" />
      <rect className="fill-base" x="10" y="23" width="12" height="6" rx="2.5" />
    </svg>
  );
}
