"use client";

import { SUBJECTS, type Subject } from "@/lib/contracts/chat";

interface EmptyStateProps {
  /** Se llama cuando la niña toca un ejemplo. */
  onSelectPrompt: (prompt: string, subject: Subject) => void;
  /** Deshabilitado mientras se está enviando. */
  disabled?: boolean;
}

/**
 * Ejemplos de prompts para cada asignatura, apropiados para 6º de primaria.
 */
const EXAMPLES: Record<Subject, string[]> = {
  mates: [
    "Tengo este problema: 3/4 + 1/2, me trabé en el denominador",
    "¿Cómo se resuelven ecuaciones con incógnitas en ambos lados?",
    "No entiendo por qué 5 × 6 = 30 y no 56",
  ],
  lengua: [
    "¿Cuál es la diferencia entre verbos regulares e irregulares?",
    "Tengo dudas con la tildes en palabras agudas, llanas y esdrújulas",
    "¿Cómo identifico el sujeto y predicado en una oración?",
  ],
  ciencias: [
    "¿Cómo funciona el ciclo del agua? Me confunden las fases",
    "Tengo que entender qué son las cadenas alimentarias",
    "No me queda claro la diferencia entre evaporación y transpiración",
  ],
};

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
      </div>

      {/* Ejemplos por asignatura */}
      {SUBJECTS.map((subject) => (
        <div key={subject}>
          <h3 className="mb-2 text-sm font-semibold text-ink-soft">
            Ejemplos de {subject === "mates" ? "Mates" : subject === "lengua" ? "Lengua" : "Ciencias"}
          </h3>
          <div className="space-y-1.5">
            {EXAMPLES[subject].map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                disabled={disabled}
                onClick={() => onSelectPrompt(prompt, subject)}
                className="w-full rounded-card border border-line bg-surface p-3 text-left text-[0.95rem] leading-snug text-ink shadow-card transition-all hover:border-sky hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
