import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ELI_SYSTEM_PROMPT, REFUSAL_MESSAGE, REPLY_STYLE_HINT } from "@/lib/ai/prompt";

/**
 * Copia literal del bloque "Prompt de sistema" de north_star.md. Si este test falla, alguien cambió
 * el prompt sin cambiar primero el documento (o al revés): gana north_star.md.
 */
const LITERAL_COPY =
  "Eres 'ELI' (Tutor Nexo), un mentor de estudio inteligente, divertido y empático para estudiantes de 6º de primaria (11-12 años). Tu objetivo es prepararlos para la secundaria. REGLAS: 1. TONO: Claro, dinámico, sin tecnicismos complejos. 2. REGLA DE ORO: NUNCA des el resultado, ni redactes textos completos. Guía paso a paso (método socrático). 3. MATEMÁTICAS: Desglosa problemas, pide identificar datos primero. 4. ESPAÑOL/CIENCIAS: Usa analogías del siglo XXI (videojuegos, vida cotidiana). Haz preguntas de 'trivia rápida'. 5. CORRECCIÓN POSITIVA: Nunca digas 'No'. Di 'Buen intento, revisemos el paso anterior'. 6. FORMATO: Párrafos de max 3 líneas, uso de negritas y viñetas.";

const NORTH_STAR = new URL("../../north_star.md", import.meta.url);

/** Extrae el bloque ```text que sigue al título "Prompt de sistema" en north_star.md. */
function promptFromNorthStar(): string | undefined {
  const doc = readFileSync(NORTH_STAR, "utf8");
  return /^## Prompt de sistema[^\n]*\n+```text\n([\s\S]*?)\n```/m.exec(doc)?.[1];
}

describe("ELI_SYSTEM_PROMPT", () => {
  it("es idéntico a la copia literal", () => {
    expect(ELI_SYSTEM_PROMPT).toBe(LITERAL_COPY);
  });

  it("es idéntico al bloque literal de north_star.md", () => {
    expect(promptFromNorthStar()).toBe(ELI_SYSTEM_PROMPT);
  });

  it("es una sola línea sin espacios sobrantes (prefijo cacheable estable)", () => {
    expect(ELI_SYSTEM_PROMPT).not.toMatch(/[\r\n]/);
    expect(ELI_SYSTEM_PROMPT).toBe(ELI_SYSTEM_PROMPT.trim());
  });

  it("contiene las seis reglas, con la regla de oro en segundo lugar", () => {
    expect(ELI_SYSTEM_PROMPT.startsWith("Eres 'ELI' (Tutor Nexo)")).toBe(true);
    for (const rule of [
      "1. TONO",
      "2. REGLA DE ORO: NUNCA des el resultado",
      "3. MATEMÁTICAS",
      "4. ESPAÑOL/CIENCIAS",
      "5. CORRECCIÓN POSITIVA",
      "6. FORMATO",
    ]) {
      expect(ELI_SYSTEM_PROMPT).toContain(rule);
    }
  });
});

describe("REFUSAL_MESSAGE", () => {
  it("es el mensaje fijo y amable del contrato 6.2", () => {
    expect(REFUSAL_MESSAGE).toBe(
      "Eso no puedo ayudarte a resolverlo aquí, pero si quieres seguimos con tus deberes.",
    );
  });

  it("no expone detalles técnicos", () => {
    expect(REFUSAL_MESSAGE).not.toMatch(/error|refusal|stop_reason|api/i);
  });
});

describe("REPLY_STYLE_HINT: tareas en español o en inglés (las escuelas de México son bilingües)", () => {
  it("pide responder en el idioma del estudiante, sea español o inglés", () => {
    expect(REPLY_STYLE_HINT).toMatch(/español o en inglés/);
    expect(REPLY_STYLE_HINT).toMatch(/idioma en que te escribe el estudiante/);
  });

  it("si escribe en español sobre una tarea en inglés, explica en español y cita el inglés", () => {
    expect(REPLY_STYLE_HINT).toMatch(/en español sobre una tarea en inglés/);
    expect(REPLY_STYLE_HINT).toMatch(/cita el inglés/);
  });

  it("por defecto, español; y sigue prohibiendo mostrar el razonamiento", () => {
    expect(REPLY_STYLE_HINT).toMatch(/si no está claro, en español/);
    expect(REPLY_STYLE_HINT).toMatch(/nunca muestres tu análisis/);
  });

  it("no toca el prompt literal de north_star.md: es un mensaje de sistema aparte", () => {
    expect(REPLY_STYLE_HINT).not.toBe(ELI_SYSTEM_PROMPT);
    expect(ELI_SYSTEM_PROMPT).not.toContain("inglés");
  });
});
