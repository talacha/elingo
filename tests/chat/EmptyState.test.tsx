import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EmptyState } from "@/components/chat/EmptyState";

const render = (disabled = false) =>
  renderToStaticMarkup(<EmptyState onSelectPrompt={vi.fn()} disabled={disabled} />);

describe("EmptyState", () => {
  it("muestra bienvenida en español y avisa de que también vale el inglés", () => {
    const html = render();
    expect(html).toContain("¡Hola! Soy ELI");
    expect(html).toContain("Cuéntame qué no entiendes");
    expect(html).toContain("You can write to me in English too.");
  });

  it("ofrece ejemplos para empezar en español y en inglés (las tareas son bilingües)", () => {
    const html = render();
    expect(html).toContain("3/4 + 1/2");
    expect(html).toContain("evaporación y transpiración");
    expect(html).toContain("their");
    expect(html).toContain("water cycle");
  });

  it("no muestra asignaturas: ni encabezados por asignatura ni el selector", () => {
    const html = render();
    expect(html).not.toMatch(/\b(Mates|Lengua|Ciencias|Matemáticas)\b/);
    expect(html).not.toMatch(/asignatura/i);
  });

  it("tiene cinco ejemplos, todos como botones", () => {
    expect((render().match(/<button/g) || []).length).toBe(5);
  });

  it("respeta disabled", () => {
    expect(render(true)).toMatch(/disabled/);
  });
});
