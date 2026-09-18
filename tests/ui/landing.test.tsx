import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/components/ui/cn";

describe("landing (app/page.tsx)", () => {
  const html = renderToStaticMarkup(<Home />);

  it("saluda, explica la regla de oro y lleva al chat con «Empezar»", () => {
    expect(html).toContain("¡Hola! Soy");
    expect(html).toContain("ELI nunca te dice la respuesta.");
    expect(html).toMatch(/<a[^>]+href="\/chat"[^>]*>Empezar<\/a>/);
  });

  it("es accesible: secciones etiquetadas, mascota con nombre y enlace para saltar al contenido", () => {
    expect(html).toContain('aria-labelledby="t-hola"');
    expect(html).toContain('role="img"');
    expect(html).toContain('href="#inicio"');
    expect(html).toContain('id="adultos"');
  });
});

describe("Button", () => {
  it("es un enlace cuando recibe href", () => {
    const html = renderToStaticMarkup(<Button href="/chat">Empezar</Button>);
    expect(html).toMatch(/^<a [^>]*href="\/chat"/);
    expect(html).toContain("bg-primary");
  });

  it("es un botón nativo de tipo button si no recibe href", () => {
    const html = renderToStaticMarkup(
      <Button variant="secondary" size="lg" className="extra">
        Enviar
      </Button>,
    );
    expect(html).toMatch(/^<button [^>]*type="button"/);
    expect(html).toContain("bg-surface");
    expect(html).toContain("extra");
  });

  it("respeta type=submit y disabled", () => {
    const html = renderToStaticMarkup(
      <Button type="submit" disabled>
        Enviar
      </Button>,
    );
    expect(html).toContain('type="submit"');
    expect(html).toContain("disabled");
  });
});

describe("Card", () => {
  it("cambia de etiqueta, de variante y de relleno", () => {
    const note = renderToStaticMarkup(
      <Card as="aside" variant="note" padded={false}>
        Nota
      </Card>,
    );
    expect(note).toMatch(/^<aside /);
    expect(note).toContain("bg-note");
    expect(note).not.toContain("p-card");

    const surface = renderToStaticMarkup(<Card>Tarjeta</Card>);
    expect(surface).toMatch(/^<div /);
    expect(surface).toContain("bg-surface");
    expect(surface).toContain("p-card");
  });
});

describe("cn", () => {
  it("ignora valores falsos", () => {
    expect(cn("a", false, undefined, null, "b")).toBe("a b");
  });
});
