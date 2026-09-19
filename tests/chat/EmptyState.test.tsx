import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EmptyState } from "@/components/chat/EmptyState";

const render = (disabled = false) =>
  renderToStaticMarkup(<EmptyState onSelectPrompt={vi.fn()} disabled={disabled} />);

describe("EmptyState", () => {
  it("muestra bienvenida", () => {
    const html = render();
    expect(html).toContain("¡Hola! Soy ELI");
    expect(html).toContain("Cuéntame qué no entiendes");
  });

  it("ofrece ejemplos para empezar de varias áreas, sin etiquetarlos por asignatura", () => {
    const html = render();
    expect(html).toContain("3/4 + 1/2");
    expect(html).toContain("verbos regulares");
    expect(html).toContain("ciclo del agua");
    // La asignatura no se elige: se deduce del mensaje.
    expect(html).not.toMatch(/Ejemplos de (Mates|Lengua|Ciencias)/);
    expect(html).not.toContain("Asignatura");
  });

  it("tiene seis ejemplos, todos como botones", () => {
    expect((render().match(/<button/g) || []).length).toBe(6);
  });

  it("respeta disabled", () => {
    expect(render(true)).toMatch(/disabled/);
  });
});
