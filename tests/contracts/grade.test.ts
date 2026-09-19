import { describe, expect, it } from "vitest";
import { buildSystemPrompt, ELI_SYSTEM_PROMPT } from "@/lib/ai/prompt";
import {
  DEFAULT_GRADE,
  GRADES,
  gradeAges,
  gradeDescription,
  gradeLabel,
  parseGrade,
} from "@/lib/contracts/grade";

describe("K-12: grados y edades", () => {
  it("cubre kínder y del 1.º al 12.º", () => {
    expect(GRADES).toHaveLength(13);
    expect(GRADES[0]).toBe("K");
    expect(GRADES.at(-1)).toBe("12");
  });

  it("la edad típica de un grado N es N+5 a N+6 años (6.º = 11-12, como decía el prompt original)", () => {
    expect(gradeAges("K")).toBe("5-6");
    expect(gradeAges("1")).toBe("6-7");
    expect(gradeAges("6")).toBe("11-12");
    expect(gradeAges("12")).toBe("17-18");
  });

  it("nombra cada nivel para el selector y el prompt", () => {
    expect(gradeLabel("K")).toBe("Kínder");
    expect(gradeDescription("K")).toBe("Kínder (5-6 años)");
    expect(gradeDescription("3")).toBe("3.º grado (8-9 años)");
    expect(gradeDescription("12")).toBe("12.º grado (17-18 años)");
  });

  it("el grado por defecto es 6.º", () => {
    expect(DEFAULT_GRADE).toBe("6");
  });
});

describe("parseGrade: entiende lo que ya hay guardado y lo que llega de fuera", () => {
  it.each([
    ["K", "K"],
    ["k", "K"],
    ["Kínder", "K"],
    ["kinder", "K"],
    ["Kindergarten", "K"],
    ["1", "1"],
    ["6", "6"],
    ["12", "12"],
    [" 9 ", "9"],
    // Valores antiguos del selector de /perfil:
    ["5º", "5"],
    ["6º", "6"],
    ["6.º", "6"],
    ["1º ESO", "7"],
    ["2º ESO", "8"],
    ["4º ESO", "10"],
    ["1º Bachillerato", "11"],
    ["2º Bachillerato", "12"],
    ["3rd", "3"],
    ["8th grade", "8"],
  ])("%j → %s", (raw, expected) => {
    expect(parseGrade(raw)).toBe(expected);
  });

  it.each([[""], ["  "], [null], [undefined], ["abc"], ["0"], ["13"], ["99"], ["5º ESO ESO 9 9"]])(
    "rechaza %j",
    (raw) => {
      expect(parseGrade(raw as string | null | undefined)).toBeNull();
    },
  );
});

describe("buildSystemPrompt: el nivel entra en el prompt", () => {
  it("con el grado por defecto (o sin grado) es EXACTAMENTE el literal de north_star.md", () => {
    expect(buildSystemPrompt()).toBe(ELI_SYSTEM_PROMPT);
    expect(buildSystemPrompt("6")).toBe(ELI_SYSTEM_PROMPT);
  });

  it.each(GRADES.filter((g) => g !== DEFAULT_GRADE))("grado %s: cambia solo la frase del nivel", (grade) => {
    const prompt = buildSystemPrompt(grade);

    expect(prompt).toContain(`estudiantes de ${gradeDescription(grade)}`);
    expect(prompt).toContain("Adapta el vocabulario, la profundidad y los ejemplos a ese nivel.");
    expect(prompt).not.toContain("6º de primaria");
    expect(prompt).not.toContain("prepararlos para la secundaria");
    // Las seis reglas siguen intactas, en el mismo orden y con la regla de oro en segundo lugar.
    const rules = ELI_SYSTEM_PROMPT.slice(ELI_SYSTEM_PROMPT.indexOf("REGLAS:"));
    expect(prompt.endsWith(rules)).toBe(true);
    expect(prompt.startsWith("Eres 'ELI' (Tutor Nexo), un mentor de estudio inteligente, divertido y empático para ")).toBe(true);
    expect(prompt).not.toMatch(/[\r\n]/);
  });

  it("es determinista por grado (prefijo cacheable estable) y distinto entre grados", () => {
    expect(buildSystemPrompt("9")).toBe(buildSystemPrompt("9"));
    expect(buildSystemPrompt("9")).not.toBe(buildSystemPrompt("2"));
  });
});
