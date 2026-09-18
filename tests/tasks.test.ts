import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { analyze } from "../scripts/tasks-check.mjs";

describe("tasks.md", () => {
  it("no tiene IDs repetidos ni dependencias inexistentes", () => {
    const result = analyze(readFileSync(new URL("../tasks.md", import.meta.url), "utf8"));
    expect(result.duplicates).toEqual([]);
    expect(result.problems).toEqual([]);
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
