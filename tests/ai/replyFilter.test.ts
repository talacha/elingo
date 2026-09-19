import { describe, expect, it } from "vitest";
import { ReplyFilter, startsLikeReasoning } from "@/lib/ai/providers/replyFilter";

/** Pasa la respuesta por el filtro trozo a trozo, como llegaría en streaming. */
function run(chunks: string[]) {
  const filter = new ReplyFilter();
  let out = "";
  for (const chunk of chunks) out += filter.push(chunk);
  out += filter.finish();
  return { out, leaked: filter.leakedThinking };
}

/** Parte un texto en trozos de `size` caracteres. */
const slices = (text: string, size: number) =>
  Array.from({ length: Math.ceil(text.length / size) }, (_, i) => text.slice(i * size, (i + 1) * size));

const LONG_ANSWER =
  "¡Buena pregunta! 🌿 Vamos por partes: **evaporación** y **transpiración** parecen lo mismo, pero no lo son. " +
  "Piensa en un charco al sol. ¿Qué crees que le pasa al agua?";

const LEAKED = `Here's a thinking process:

1. Analyze User Input:

User says: "No me queda claro la diferencia entre evaporación y transpiración"
Language: Spanish
Persona: 'ELI' (Tutor Nexo)

Wait, I violated rules. I gave parts of the answer. Forbidden.`;

describe("ReplyFilter: respuesta normal", () => {
  it("deja pasar íntegra una respuesta normal, la reciba como la reciba", () => {
    for (const size of [1, 3, 7, 50, 1000]) {
      expect(run(slices(LONG_ANSWER, size))).toEqual({ out: LONG_ANSWER, leaked: false });
    }
  });

  it("una respuesta corta se emite al terminar", () => {
    expect(run(["¡Hola!", " ¿Qué datos tienes?"])).toEqual({ out: "¡Hola! ¿Qué datos tienes?", leaked: false });
  });

  it("no toca texto que solo menciona pensar o analizar en mitad de la respuesta", () => {
    const text = "Vamos a pensar juntos: primero analiza los datos del problema y dime qué ves. " + LONG_ANSWER;
    expect(run(slices(text, 5))).toEqual({ out: text, leaked: false });
  });

  it("no confunde un '<' normal con una etiqueta", () => {
    const text = "Si 3 < 5 entonces 5 > 3, ¿verdad? " + LONG_ANSWER;
    expect(run(slices(text, 4)).out).toBe(text);
  });
});

describe("ReplyFilter: bloques <think>", () => {
  it("quita un bloque <think> del principio", () => {
    expect(run([`<think>El usuario pregunta por la evaporación…</think>${LONG_ANSWER}`])).toEqual({
      out: LONG_ANSWER,
      leaked: false,
    });
  });

  it("lo quita aunque las etiquetas lleguen partidas entre trozos", () => {
    const text = `<think>razonamiento largo que no debe verse</think>\n\n${LONG_ANSWER}`;
    for (const size of [1, 2, 3, 5, 11]) {
      expect(run(slices(text, size))).toEqual({ out: LONG_ANSWER, leaked: false });
    }
  });

  it("acepta <thinking> y mayúsculas, y varios bloques", () => {
    const text = `<THINKING>a</THINKING>Hola. <think>b</think>${LONG_ANSWER}`;
    expect(run(slices(text, 3)).out).toBe(`Hola. ${LONG_ANSWER}`);
  });

  it("si el bloque nunca se cierra, no se enseña nada", () => {
    const result = run(["<think>pensando…", " y pensando sin fin"]);
    expect(result.out).toBe("");
  });
});

describe("ReplyFilter: razonamiento en claro al principio (el caso real)", () => {
  it("descarta entera una respuesta que arranca como «thinking process» y lo marca", () => {
    for (const size of [1, 4, 40, 500]) {
      expect(run(slices(LEAKED, size))).toEqual({ out: "", leaked: true });
    }
  });

  it("también cuando es corta y termina antes de la ventana de decisión", () => {
    expect(run(["Here's a thinking process:\n1. Analyze User Input"])).toEqual({ out: "", leaked: true });
  });

  it.each([
    "Here's a thinking process:\n\n1. Analyze User Input:",
    "Here is my thinking process: first I read the question",
    "Thinking Process:\n1. ...",
    "Reasoning process: the student asks about",
    "1. **Analyze User Input:** the student writes in Spanish",
    "Analyze the request: the user wants an explanation",
    "Aquí va mi proceso de pensamiento: 1. Analizar",
    "Proceso de pensamiento:\n1. Analizar la pregunta",
    "  \n Here's a thinking process:",
  ])("detecta %j", (text) => {
    expect(startsLikeReasoning(text)).toBe(true);
  });

  it.each([
    "¡Buen intento! Revisemos el paso anterior.",
    "Vamos a pensar juntos en el problema.",
    "Piensa en un charco al sol.",
    "Analicemos los datos: ¿cuántos hay?",
    "Here you go: ¿qué crees que pasa?",
    "",
  ])("no marca como razonamiento %j", (text) => {
    expect(startsLikeReasoning(text)).toBe(false);
  });

  it("una vez descartada, no emite nada más aunque el resto parezca una respuesta", () => {
    const result = run([LEAKED, "\n\n¡Hola! Esta sí sería la respuesta final, pero llega tras el razonamiento."]);
    expect(result).toEqual({ out: "", leaked: true });
  });
});
