import type { TutorTurn } from "@/lib/contracts/ai";
import { getEnv } from "@/lib/env";

/**
 * Ventana deslizante del historial: el guardrail de coste de north_star.md ("6 pares").
 *
 * Un par es un mensaje `user` seguido de su respuesta `assistant`. Varios mensajes seguidos del
 * mismo rol (la alumna escribe dos veces, ELI responde en dos partes) pertenecen al mismo par, igual
 * que los combina la API. Se conservan los últimos `pairs` pares completos más el turno `user`
 * pendiente de respuesta que cierra la lista; se descarta desde el más antiguo.
 *
 * Garantías:
 * - El resultado empieza siempre por `user` (los `assistant` iniciales sin pregunta se descartan)
 *   o es una lista vacía.
 * - `pairs = 0` deja solo el turno pendiente de la alumna (sin historial).
 * - Las listas cortas (menos de `pairs` pares) se devuelven intactas.
 * - No muta la entrada: devuelve una lista nueva con los mismos objetos, en el mismo orden.
 *
 * @param messages Historial en orden cronológico, solo texto (nunca bloques de thinking).
 * @param pairs Entero >= 0; por defecto `AI_WINDOW_PAIRS` (6).
 */
export function slidingWindow<T extends TutorTurn>(
  messages: readonly T[],
  pairs: number = getEnv().AI_WINDOW_PAIRS,
): T[] {
  if (!Number.isInteger(pairs) || pairs < 0) {
    throw new RangeError(`slidingWindow: pairs debe ser un entero >= 0 (recibido ${pairs})`);
  }

  // Recorre desde el final. Cada `user` seguido de un `assistant` abre un par completo; el corte se
  // hace justo antes del `user` que abriría el par número pairs + 1 (el más antiguo que sobra).
  let start = messages.length;
  let completePairs = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role !== "user") continue;
    const opensPair = i + 1 < messages.length && messages[i + 1].role === "assistant";
    if (opensPair) {
      if (completePairs === pairs) break;
      completePairs++;
    }
    start = i;
  }
  return messages.slice(start);
}
