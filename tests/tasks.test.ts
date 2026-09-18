import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { analyze } from "../scripts/tasks-check.mjs";

describe("tasks.md", () => {
  it("no tiene IDs repetidos ni dependencias inexistentes", () => {
    const result = analyze(readFileSync(new URL("../tasks.md", import.meta.url), "utf8"));
    expect(result.duplicates).toEqual([]);
    expect(result.collisions).toEqual([]);
    expect(result.problems).toEqual([]);
  });

  it("en la Bandeja conserva las dos ideas cuando dos agentes usaron el mismo ID", () => {
    const sample = [
      "| N-010 | Idea de T-020 | T-020 |",
      "| N-010 | Idea de T-011 | T-011 |",
      "| N-T012-1 | Idea con ID nuevo | T-012 |",
      "| N-T012-1 | Idea con ID nuevo | T-012 |",
    ].join("\n");
    const result = analyze(sample);
    expect(result.collisions).toEqual(["N-010"]);
    expect(result.duplicates).toEqual(["N-T012-1"]);
    expect(result.fixed.split("\n")).toEqual([
      "| N-010 | Idea de T-020 | T-020 |",
      "| N-010-b | Idea de T-011 | T-011 |",
      "| N-T012-1 | Idea con ID nuevo | T-012 |",
    ]);
  });

  it("al deduplicar conserva la fila más avanzada de cada ID", () => {
    const sample = [
      "| T-002 | M0 | DO | done | T-001 | 15 | hecho |",
      "| T-010 | M1 | BE | todo | T-001 | 9 | |",
      "| T-002 | M0 | DO | todo | T-001 | 15 | |",
      "| T-010 | M1 | BE | done | T-001 | 9 | hecho |",
      "| T-001 | M0 | BE | done | — | 26 | |",
    ].join("\n");
    const result = analyze(sample);
    expect(result.duplicates).toEqual(["T-002", "T-010"]);
    expect(result.changed).toBe(true);
    expect(result.fixed.split("\n")).toEqual([
      "| T-002 | M0 | DO | done | T-001 | 15 | hecho |",
      "| T-010 | M1 | BE | done | T-001 | 9 | hecho |",
      "| T-001 | M0 | BE | done | — | 26 | |",
    ]);
  });

  it("detecta dependencias rotas", () => {
    const result = analyze("| T-005 | M1 | BE | todo | T-999 | 0 | |");
    expect(result.problems).toEqual(["T-005: depende de T-999, que no existe"]);
  });
});
