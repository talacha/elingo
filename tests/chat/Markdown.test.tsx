import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Markdown } from "@/components/chat/Markdown";

describe("Markdown", () => {
  it("renderiza texto plano sin markdown", () => {
    const html = renderToStaticMarkup(<Markdown content="Hola, mundo" />);
    expect(html).toContain("Hola, mundo");
  });

  it("renderiza negritas con **", () => {
    const html = renderToStaticMarkup(<Markdown content="Esto es **importante**" />);
    expect(html).toContain("<strong>importante</strong>");
  });

  it("renderiza saltos de línea como <br>", () => {
    const html = renderToStaticMarkup(
      <Markdown content={`Primera línea
Segunda línea`} />,
    );
    expect(html).toContain("<br");
    expect(html).toContain("Primera línea");
    expect(html).toContain("Segunda línea");
  });

  it("renderiza listas no ordenadas con - ", () => {
    const html = renderToStaticMarkup(
      <Markdown content={`- Primer item
- Segundo item`} />,
    );
    expect(html).toContain("<ul");
    expect(html).toContain("<li");
    expect(html).toContain("Primer item");
    expect(html).toContain("Segundo item");
  });

  it("maneja párrafos separados por líneas en blanco", () => {
    const html = renderToStaticMarkup(
      <Markdown content={`Párrafo 1

Párrafo 2`} />,
    );
    // Debe haber dos párrafos
    const pCount = (html.match(/<p/g) || []).length;
    expect(pCount).toBe(2);
  });

  it("combina negritas con listas", () => {
    const html = renderToStaticMarkup(
      <Markdown content={`- **Opción A**: buena
- **Opción B**: mejor`} />,
    );
    expect(html).toContain("<strong>Opción A</strong>");
    expect(html).toContain("<strong>Opción B</strong>");
    expect(html).toContain("<ul");
  });

  it("no renderiza HTML crudo", () => {
    const html = renderToStaticMarkup(
      <Markdown content="<script>alert('xss')</script>" />,
    );
    // El contenido debe estar escapado, no ejecutado
    expect(html).not.toContain("<script>");
  });

  it("trata ** sin cierre como texto plano", () => {
    const html = renderToStaticMarkup(
      <Markdown content="Texto sin cierre **" />,
    );
    // El "**" se trata como dos asteriscos separados, no como negrita
    expect(html).toContain("Texto sin cierre");
    expect(html).toContain("**");
  });
});
