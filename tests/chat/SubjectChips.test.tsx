import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SubjectChips } from "@/components/chat/SubjectChips";

describe("SubjectChips", () => {
  it("renderiza tres chips para Mates, Lengua y Ciencias", () => {
    const onChange = vi.fn();
    const html = renderToStaticMarkup(
      <SubjectChips active={undefined} onChange={onChange} disabled={false} />,
    );
    expect(html).toContain("Mates");
    expect(html).toContain("Lengua");
    expect(html).toContain("Ciencias");
  });

  it("destaca el chip activo con el color primario", () => {
    const onChange = vi.fn();
    const html = renderToStaticMarkup(
      <SubjectChips active="mates" onChange={onChange} disabled={false} />,
    );
    // El chip de Mates debe tener la clase bg-primary
    expect(html).toMatch(/Mates.*bg-primary/);
  });

  it("respeta disabled", () => {
    const onChange = vi.fn();
    const html = renderToStaticMarkup(
      <SubjectChips active={undefined} onChange={onChange} disabled={true} />,
    );
    expect(html).toContain("disabled");
  });

  it("muestra plantillas de entrada como title", () => {
    const onChange = vi.fn();
    const html = renderToStaticMarkup(
      <SubjectChips active={undefined} onChange={onChange} disabled={false} />,
    );
    expect(html).toContain("Tengo este problema: … me trabé en …");
    expect(html).toContain("Tengo esta duda de ortografía:");
    expect(html).toContain("Tengo esta pregunta de ciencias:");
  });
});
