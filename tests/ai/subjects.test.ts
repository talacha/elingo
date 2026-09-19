import { describe, expect, it } from "vitest";
import { inferSubject, inferSubjectFromText, subjectHint } from "@/lib/ai/subjects";

describe("inferSubjectFromText: deduce la asignatura del mensaje", () => {
  it.each([
    // Los ejemplos que ELI mostraba antes con la asignatura elegida a mano.
    ["Tengo este problema: 3/4 + 1/2, me trabé en el denominador", "mates"],
    ["¿Cómo se resuelven ecuaciones con incógnitas en ambos lados?", "mates"],
    ["No entiendo por qué 5 × 6 = 30 y no 56", "mates"],
    ["¿Cuál es la diferencia entre verbos regulares e irregulares?", "lengua"],
    ["Tengo dudas con la tildes en palabras agudas, llanas y esdrújulas", "lengua"],
    ["¿Cómo identifico el sujeto y predicado en una oración?", "lengua"],
    ["¿Cómo funciona el ciclo del agua? Me confunden las fases", "ciencias"],
    ["Tengo que entender qué son las cadenas alimentarias", "ciencias"],
    ["No me queda claro la diferencia entre evaporación y transpiración", "ciencias"],
    // Otras formas de decirlo.
    ["cuanto es 12 : 4", "mates"],
    ["how do I find the AREA del triángulo?", "mates"],
    ["NECESITO AYUDA CON EL PERÍMETRO", "mates"],
    ["Me piden redactar un resumen del cuento", "lengua"],
    ["¿Qué es un sinónimo de feliz?", "lengua"],
    ["Por qué las plantas hacen la fotosíntesis", "ciencias"],
    ["¿Qué pasa con la gravedad en la Luna?", "ciencias"],
  ])("%j → %s", (text, expected) => {
    expect(inferSubjectFromText(text)).toBe(expected);
  });

  it.each([
    [""],
    ["hola"],
    ["no lo entiendo"],
    ["ayúdame con mis deberes"],
    // Empate entre asignaturas: sin señal clara no se adivina.
    ["el verbo de la suma"],
  ])("sin señal clara (%j) → null", (text) => {
    expect(inferSubjectFromText(text)).toBeNull();
  });

  it("no depende de tildes ni de mayúsculas", () => {
    expect(inferSubjectFromText("ORTOGRAFÍA")).toBe(inferSubjectFromText("ortografia"));
    expect(inferSubjectFromText("Fotosíntesis")).toBe("ciencias");
  });

  it("no confunde una palabra que solo contiene una señal (p. ej. «sol» dentro de «solución»)", () => {
    expect(inferSubjectFromText("dame la solución")).toBeNull();
  });
});

describe("inferSubject: asignatura de la conversación", () => {
  const user = (content: string) => ({ role: "user", content });
  const eli = (content: string) => ({ role: "assistant", content });

  it("usa el último mensaje de la alumna con señal clara", () => {
    expect(inferSubject([user("Tengo un problema: 3/4 + 1/2")])).toBe("mates");
  });

  it("una continuación sin pistas conserva el tema anterior", () => {
    expect(
      inferSubject([user("¿Qué es la fotosíntesis?"), eli("¿Qué crees tú?"), user("no lo entiendo")]),
    ).toBe("ciencias");
  });

  it("un cambio de tema lo actualiza", () => {
    expect(
      inferSubject([user("¿Qué es la fotosíntesis?"), eli("…"), user("ahora una duda de ortografía y tildes")]),
    ).toBe("lengua");
  });

  it("ignora lo que dice ELI (sus respuestas no deciden la asignatura)", () => {
    expect(inferSubject([user("hola"), eli("Vamos con las fracciones y la suma de decimales")])).toBeNull();
  });

  it("sin señal en ningún mensaje de la alumna → null", () => {
    expect(inferSubject([])).toBeNull();
    expect(inferSubject([user("hola"), user("ayuda")])).toBeNull();
  });
});

describe("subjectHint", () => {
  it("dice que la asignatura se dedujo, no que la eligiera la alumna", () => {
    expect(subjectHint("ciencias")).toBe("La pregunta de la alumna parece ser de la asignatura: Ciencias.");
    expect(subjectHint(undefined)).toBeUndefined();
  });
});
