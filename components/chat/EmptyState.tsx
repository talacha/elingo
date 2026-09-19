"use client";

interface EmptyStateProps {
  /** Se llama cuando la niña toca un ejemplo. */
  onSelectPrompt: (prompt: string) => void;
  /** Deshabilitado mientras se está enviando. */
  disabled?: boolean;
}

/**
 * Ejemplos para empezar, en español y en inglés (las tareas pueden estar en cualquiera de los dos).
 * No van etiquetados por asignatura: ELI no las maneja.
 */
const EXAMPLES: string[] = [
  "Tengo este problema: 3/4 + 1/2, me trabé en el denominador",
  "No me queda claro la diferencia entre evaporación y transpiración",
  "¿Cómo identifico el sujeto y predicado en una oración?",
  "I don't understand the difference between “their” and “there”",
  "Can you help me check my homework about the water cycle?",
];

export function EmptyState({ onSelectPrompt, disabled }: EmptyStateProps) {
  return (
    <div className="space-y-5">
      {/* Bienvenida */}
      <div className="mb-4 grid gap-1.5 rounded-card border border-line bg-surface p-5 shadow-card">
        <p className="m-0 font-display text-2xl font-bold">¡Hola! Soy ELI.</p>
        <p className="m-0 max-w-[44ch] text-ink-soft">
          Cuéntame qué no entiendes de tus deberes y lo resolvemos juntos, paso a paso. Yo no te doy
          la respuesta: te ayudo a encontrarla.
        </p>
        <p className="m-0 max-w-[44ch] text-ink-soft">
          You can write to me in English too.
        </p>
      </div>

      {/* Ejemplos para empezar */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink-soft">O prueba con una de estas dudas:</h3>
        <div className="space-y-1.5">
          {EXAMPLES.map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={disabled}
              onClick={() => onSelectPrompt(prompt)}
              className="w-full rounded-card border border-line bg-surface p-3 text-left text-[0.95rem] leading-snug text-ink shadow-card transition-all hover:border-sky hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
