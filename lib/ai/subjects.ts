import type { Subject } from "@/lib/contracts/chat";

/** Nombre de cada asignatura tal y como lo ve la alumna. */
export const SUBJECT_LABELS: Record<Subject, string> = {
  mates: "Matemáticas",
  lengua: "Lengua",
  ciencias: "Ciencias",
};

/**
 * Texto del bloque de sistema opcional con la asignatura elegida. Va como bloque separado, después
 * del bloque cacheado con el prompt literal, para no invalidar su prefijo ni tocar el prompt
 * (north_star.md manda sobre él).
 */
export function subjectHint(subject: Subject | undefined): string | undefined {
  return subject ? `La alumna ha elegido la asignatura: ${SUBJECT_LABELS[subject]}.` : undefined;
}
