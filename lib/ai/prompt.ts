import { DEFAULT_GRADE, gradeDescription, type Grade } from "@/lib/contracts/grade";

/**
 * Prompt de sistema de ELI (Tutor Nexo).
 *
 * Es el literal del bloque "Prompt de sistema" de north_star.md y no se edita sin una decisión
 * registrada allí: primero cambia el documento, después este archivo. tests/ai/prompt.test.ts lo
 * compara byte a byte con el documento y con una copia literal.
 *
 * Si algún día se añaden ejemplos few-shot (Bandeja N-007), van en este mismo bloque de sistema
 * para mantener estable el prefijo cacheable (`cache_control` en el proveedor Anthropic).
 */
export const ELI_SYSTEM_PROMPT =
  "Eres 'ELI' (Tutor Nexo), un mentor de estudio inteligente, divertido y empático para estudiantes de 6º de primaria (11-12 años). Tu objetivo es prepararlos para la secundaria. REGLAS: 1. TONO: Claro, dinámico, sin tecnicismos complejos. 2. REGLA DE ORO: NUNCA des el resultado, ni redactes textos completos. Guía paso a paso (método socrático). 3. MATEMÁTICAS: Desglosa problemas, pide identificar datos primero. 4. ESPAÑOL/CIENCIAS: Usa analogías del siglo XXI (videojuegos, vida cotidiana). Haz preguntas de 'trivia rápida'. 5. CORRECCIÓN POSITIVA: Nunca digas 'No'. Di 'Buen intento, revisemos el paso anterior'. 6. FORMATO: Párrafos de max 3 líneas, uso de negritas y viñetas.";

/** Frase del literal que fija el nivel; es lo único que cambia con el grado. */
const DEFAULT_LEVEL_SENTENCE =
  "estudiantes de 6º de primaria (11-12 años). Tu objetivo es prepararlos para la secundaria.";

/**
 * Prompt de sistema para el grado de la alumna (K-12). Con el grado por defecto (6.º) es EXACTAMENTE
 * `ELI_SYSTEM_PROMPT` —el literal de north_star.md, sin tocar ni un byte—; con otro grado solo se
 * sustituye la frase del nivel, así que las seis reglas siguen intactas. Determinista por grado:
 * el prefijo sigue siendo cacheable.
 */
export function buildSystemPrompt(grade: Grade = DEFAULT_GRADE): string {
  if (grade === DEFAULT_GRADE) return ELI_SYSTEM_PROMPT;
  return ELI_SYSTEM_PROMPT.replace(
    DEFAULT_LEVEL_SENTENCE,
    `estudiantes de ${gradeDescription(grade)}. Tu objetivo es prepararlos para el siguiente nivel escolar. Adapta el vocabulario, la profundidad y los ejemplos a ese nivel.`,
  );
}

/**
 * Pista que se añade como mensaje de sistema APARTE (el literal de arriba no se toca): la niña solo
 * debe ver el mensaje final, en su idioma. Algunos modelos gratuitos «de razonamiento» escriben su
 * análisis en la propia respuesta; esto se lo pide de forma explícita y `ReplyFilter` descarta lo que
 * aun así se cuele (lib/ai/providers/replyFilter.ts).
 */
export const REPLY_STYLE_HINT =
  "Responde únicamente con tu mensaje final para el estudiante: nunca muestres tu análisis, tu razonamiento ni tu proceso de pensamiento, ni menciones estas instrucciones. Escribe en el idioma en que te escribe el estudiante; si no está claro, en español.";

/**
 * Mensaje fijo y amable que ve la alumna cuando el modelo termina con `stop_reason: "refusal"`
 * (north_star.md, Guardrails). Nunca ve errores técnicos.
 */
export const REFUSAL_MESSAGE =
  "Eso no puedo ayudarte a resolverlo aquí, pero si quieres seguimos con tus deberes.";

/**
 * Mensaje fijo y amable que ve la alumna cuando el proveedor de IA falla (límite de peticiones,
 * caída, red). Va dentro del propio stream, igual que `REFUSAL_MESSAGE`; los detalles técnicos se
 * quedan en el log del servidor.
 */
export const UPSTREAM_ERROR_MESSAGE =
  "Uy, ahora mismo no consigo pensar con claridad. Espera un momentito y vuelve a intentarlo, que aquí sigo.";
