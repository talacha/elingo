/**
 * Nivel escolar K-12 de la alumna. Sirve para dos cosas: el selector de /perfil y el prompt de
 * sistema (`buildSystemPrompt`), que adapta el nivel de las respuestas. Fuente de verdad: tasks.md 6.15.
 *
 * Valor canónico: "K" (kínder) y "1"…"12". La edad típica de un grado N es N+5 a N+6 años (6.º → 11-12,
 * como decía el prompt original). `users.grade` es texto libre en la base de datos y guarda valores
 * antiguos ("6º", "1º ESO"): `parseGrade` los entiende para no romper perfiles existentes.
 */
export const GRADES = ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"] as const;
export type Grade = (typeof GRADES)[number];

/** Grado por defecto: el del prompt original (6.º de primaria, 11-12 años). */
export const DEFAULT_GRADE: Grade = "6";

/** Edad típica: "5-6" para kínder, N+5 a N+6 para el grado N. */
export function gradeAges(grade: Grade): string {
  const low = grade === "K" ? 5 : Number(grade) + 5;
  return `${low}-${low + 1}`;
}

export function gradeLabel(grade: Grade): string {
  return grade === "K" ? "Kínder" : `${grade}.º grado`;
}

/** «6.º grado (11-12 años)»: cómo se nombra el nivel en el selector y en el prompt. */
export function gradeDescription(grade: Grade): string {
  return `${gradeLabel(grade)} (${gradeAges(grade)} años)`;
}

/**
 * Interpreta un grado escrito de cualquier manera que haya guardado la app: "K", "kínder", "6", "6º",
 * "6.º", "5º" (primaria), "1º ESO" (= 7.º grado), "2º Bachillerato" (= 12.º). `null` si no se reconoce.
 */
export function parseGrade(raw: string | null | undefined): Grade | null {
  const text = (raw ?? "").trim().toLowerCase();
  if (!text) return null;
  if (/^(k|kinder|kínder|kindergarten|preescolar)$/.test(text)) return "K";

  const n = /\d{1,2}/.exec(text);
  if (!n) return null;
  let grade = Number(n[0]);
  if (/\beso\b/.test(text)) {
    if (grade < 1 || grade > 4) return null; // la ESO tiene cuatro cursos
    grade += 6; // 1.º ESO = 7.º grado … 4.º ESO = 10.º
  } else if (/bachiller/.test(text)) {
    if (grade < 1 || grade > 2) return null; // el Bachillerato tiene dos cursos
    grade += 10; // 1.º Bach. = 11.º, 2.º = 12.º
  }
  return grade >= 1 && grade <= 12 ? (String(grade) as Grade) : null;
}
