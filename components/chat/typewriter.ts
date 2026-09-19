/**
 * Máquina de estados del efecto «máquina de escribir» del indicador «ELI está pensando…»:
 * escribe la frase letra a letra, deja el cursor parpadeando 3 veces, la borra rápido y pasa a la siguiente.
 *
 *   typing ──(última letra)──▶ holding ──(3 parpadeos)──▶ deleting ──(vacía)──▶ typing (frase nueva)
 *
 * Es pura (sin React ni temporizadores) para poder probarla; `TypingIndicator` la mueve con `setTimeout`.
 */
import { nextPhraseIndex } from "./thinkingPhrases";

export type TypewriterPhase = "typing" | "holding" | "deleting";

export interface TypewriterState {
  /** Frase actual (índice en `THINKING_PHRASES`). */
  index: number;
  /** Cuántas letras se ven. */
  shown: number;
  phase: TypewriterPhase;
}

/** Escribir es rápido; borrar, más todavía. */
export const TYPE_MS = 35;
export const DELETE_MS = 15;

/** Un parpadeo completo (cursor visible y luego oculto) y cuántos se dan antes de borrar. */
export const BLINK_CYCLE_MS = 500;
export const BLINK_COUNT = 3;
const HOLD_MS = BLINK_CYCLE_MS * BLINK_COUNT;

export const INITIAL_STATE: TypewriterState = { index: 0, shown: 0, phase: "typing" };

/** Cuánto se espera antes de dar el siguiente paso desde este estado. */
export function delayFor(phase: TypewriterPhase): number {
  if (phase === "typing") return TYPE_MS;
  if (phase === "deleting") return DELETE_MS;
  return HOLD_MS;
}

/** Siguiente estado. `lengths[i]` es el número de letras de la frase `i`. */
export function step(
  state: TypewriterState,
  lengths: readonly number[],
  random: () => number = Math.random,
): TypewriterState {
  const length = lengths[state.index] ?? 0;
  switch (state.phase) {
    case "typing": {
      const shown = Math.min(state.shown + 1, length);
      return { ...state, shown, phase: shown >= length ? "holding" : "typing" };
    }
    case "holding":
      return { ...state, phase: "deleting" };
    case "deleting": {
      const shown = Math.max(state.shown - 1, 0);
      if (shown > 0) return { ...state, shown };
      return { index: nextPhraseIndex(state.index, lengths.length, random), shown: 0, phase: "typing" };
    }
  }
}
