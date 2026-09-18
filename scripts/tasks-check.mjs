#!/usr/bin/env node
// Valida tasks.md y, con --fix, repara las filas duplicadas que deja el driver
// `merge=union` cuando dos agentes cambian filas adyacentes de la tabla de estado.
// Uso: node scripts/tasks-check.mjs [--fix] [ruta/a/tasks.md]
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const PRECEDENCE = { done: 4, blocked: 3, "in-progress": 2, todo: 1, new: 0 };
const ROW = /^\| (T-\d{3}|N-[A-Za-z0-9-]+) \|/;
const PIPE = /(?<!\\)\|/;

function cellsOf(line) {
  return line.split(PIPE).map((c) => c.trim());
}

function statusOf(id, line) {
  return id.startsWith("T-") ? cellsOf(line)[4] : "new";
}

function rank(status) {
  return PRECEDENCE[status] ?? -1;
}

/** Analiza el texto: IDs repetidos, colisiones de la Bandeja, dependencias rotas y versión reparada. */
export function analyze(text) {
  const lines = text.split("\n");
  const chosen = new Map();
  const drop = new Set();
  const rename = new Map();
  const suffix = new Map();
  const duplicates = [];
  const collisions = [];

  lines.forEach((line, i) => {
    const m = ROW.exec(line);
    if (!m) return;
    const id = m[1];
    const prevIdx = chosen.get(id);
    if (prevIdx === undefined) {
      chosen.set(id, i);
      return;
    }
    const prev = lines[prevIdx];
    if (id.startsWith("N-")) {
      if (line.trim() === prev.trim()) {
        // Copia exacta que deja merge=union: sobra.
        drop.add(i);
        duplicates.push(id);
        return;
      }
      // Dos agentes eligieron el mismo ID para ideas distintas: se conservan ambas y la posterior se renombra.
      const n = (suffix.get(id) ?? 0) + 1;
      suffix.set(id, n);
      rename.set(i, `${id}-${String.fromCharCode(97 + n)}`);
      collisions.push(id);
      return;
    }
    duplicates.push(id);
    const a = rank(statusOf(id, line));
    const b = rank(statusOf(id, prev));
    const keepNew = a > b || (a === b && line.length > prev.length);
    if (keepNew) {
      drop.add(prevIdx);
      chosen.set(id, i);
    } else {
      drop.add(i);
    }
  });

  const problems = [];
  for (const [id, idx] of chosen) {
    if (!id.startsWith("T-")) continue;
    const cells = cellsOf(lines[idx]);
    const status = cells[4];
    if (!(status in PRECEDENCE)) problems.push(`${id}: estado desconocido "${status}"`);
    const deps = (cells[5] ?? "")
      .replace("—", "")
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean);
    for (const dep of deps) {
      if (!chosen.has(dep)) problems.push(`${id}: depende de ${dep}, que no existe`);
    }
  }

  const fixed = lines
    .map((line, i) => (rename.has(i) ? line.replace(ROW, `| ${rename.get(i)} |`) : line))
    .filter((_, i) => !drop.has(i))
    .join("\n");

  return {
    duplicates: [...new Set(duplicates)],
    collisions: [...new Set(collisions)],
    problems,
    changed: drop.size > 0 || rename.size > 0,
    fixed,
  };
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  const fix = process.argv.includes("--fix");
  const file = process.argv.slice(2).find((a) => a.endsWith(".md")) ?? "tasks.md";
  const result = analyze(readFileSync(file, "utf8"));
  if (result.duplicates.length) console.log(`IDs repetidos: ${result.duplicates.join(", ")}`);
  if (result.collisions.length)
    console.log(`Bandeja: mismo ID con contenido distinto: ${result.collisions.join(", ")}`);
  for (const p of result.problems) console.log(`Problema: ${p}`);
  if (fix && result.changed) {
    writeFileSync(file, result.fixed);
    console.log(`${file} reparado (duplicados eliminados, colisiones renombradas)`);
  }
  const clean = result.duplicates.length === 0 && result.collisions.length === 0;
  const ok = result.problems.length === 0 && (fix || clean);
  if (ok) console.log(`${file}: OK`);
  process.exit(ok ? 0 : 1);
}
