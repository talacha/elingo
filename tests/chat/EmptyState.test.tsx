import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EmptyState } from "@/components/chat/EmptyState";

describe("EmptyState", () => {
  it("muestra bienvenida", () => {
    const onSelectPrompt = vi.fn();
    const html = renderToStaticMarkup(
      <EmptyState onSelectPrompt={onSelectPrompt} disabled={false} />,
    );
    expect(html).toContain("¡Hola! Soy ELI");
    expect(html).toContain("Cuéntame qué no entiendes");
  });

  it("muestra ejemplos para cada asignatura", () => {
    const onSelectPrompt = vi.fn();
    const html = renderToStaticMarkup(
      <EmptyState onSelectPrompt={onSelectPrompt} disabled={false} />,
    );
    // Mates
    expect(html).toContain("Ejemplos de Mates");
    expect(html).toContain("3/4 + 1/2");
    // Lengua
    expect(html).toContain("Ejemplos de Lengua");
    expect(html).toContain("verbos regulares");
    // Ciencias
    expect(html).toContain("Ejemplos de Ciencias");
    expect(html).toContain("ciclo del agua");
  });

  it("tiene tres ejemplos por asignatura", () => {
    const onSelectPrompt = vi.fn();
    const html = renderToStaticMarkup(
      <EmptyState onSelectPrompt={onSelectPrompt} disabled={false} />,
    );
    // 3 asignaturas × 3 ejemplos = 9 botones
    const buttonCount = (html.match(/<button/g) || []).length;
    expect(buttonCount).toBe(9);
  });

  it("respeta disabled", () => {
    const onSelectPrompt = vi.fn();
    const html = renderToStaticMarkup(
      <EmptyState onSelectPrompt={onSelectPrompt} disabled={true} />,
    );
    expect(html).toMatch(/disabled/);
  });
});
