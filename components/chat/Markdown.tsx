"use client";

import { useMemo } from "react";
import { cn } from "@/components/ui/cn";

interface MarkdownProps {
  content: string;
  className?: string;
}

/**
 * Renderiza markdown seguro con soporte mínimo: negritas, viñetas, saltos de línea.
 * Sin HTML crudo, sin embed, sin plugins peligrosos.
 *
 * Sintaxis soportada:
 * - **texto** → <strong>texto</strong>
 * - - item → <li>item</li> en <ul>
 * - Saltos de línea respetados
 */
export function Markdown({ content, className }: MarkdownProps) {
  const parsed = useMemo(() => parseMarkdown(content), [content]);

  return (
    <div className={cn("space-y-2", className)}>
      {parsed.map((element, i) => (
        <MarkdownElement key={i} element={element} />
      ))}
    </div>
  );
}

// MARK: Parser

type MarkdownElement =
  | { type: "paragraph"; content: (TextSpan | TextNode)[] }
  | { type: "list"; items: (TextSpan | TextNode)[] };

type TextSpan = { type: "text"; content: string } | { type: "bold"; content: string };
type TextNode = TextSpan | { type: "linebreak" };

/**
 * Divide el contenido en párrafos, detecta listas y parsea markdown ligero.
 * Conserva saltos de línea dentro de párrafos.
 */
function parseMarkdown(content: string): MarkdownElement[] {
  const lines = content.split("\n");
  const result: MarkdownElement[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Detectar inicio de lista (línea que empieza con "- ")
    if (line.trim().startsWith("- ")) {
      const items: (TextSpan | TextNode)[] = [];

      while (i < lines.length && lines[i].trim().startsWith("- ")) {
        const itemText = lines[i].trim().slice(2); // Quita "- "
        items.push(...parseInlineMarkdown(itemText));
        items.push({ type: "linebreak" }); // Salto entre items
        i++;
      }

      // Quitar el último salto de línea
      if (items.length > 0 && items[items.length - 1].type === "linebreak") {
        items.pop();
      }

      if (items.length > 0) {
        result.push({ type: "list", items });
      }
      continue;
    }

    // Línea en blanco: ignorar pero marca fin de párrafo implícito
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Párrafo normal: acumular líneas hasta la siguiente en blanco o lista
    const paragraphLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !lines[i].trim().startsWith("- ")) {
      paragraphLines.push(lines[i]);
      i++;
    }

    if (paragraphLines.length > 0) {
      const content: (TextSpan | TextNode)[] = [];

      // Parsear inline markdown en cada línea del párrafo
      paragraphLines.forEach((line, idx) => {
        content.push(...parseInlineMarkdown(line));
        if (idx < paragraphLines.length - 1) {
          content.push({ type: "linebreak" });
        }
      });

      result.push({ type: "paragraph", content });
    }
  }

  return result;
}

/**
 * Parsea markdown inline: **negrita**, saltos de línea. Sin HTML.
 */
function parseInlineMarkdown(text: string): (TextSpan | TextNode)[] {
  const result: (TextSpan | TextNode)[] = [];
  let remaining = text;

  while (remaining) {
    // Buscar el siguiente **
    const boldStart = remaining.indexOf("**");
    if (boldStart === -1) {
      // No hay más negritas
      if (remaining) {
        result.push({ type: "text", content: remaining });
      }
      break;
    }

    // Texto antes de la negrita
    if (boldStart > 0) {
      result.push({ type: "text", content: remaining.slice(0, boldStart) });
    }

    // Buscar el cierre de negrita
    const boldEnd = remaining.indexOf("**", boldStart + 2);
    if (boldEnd === -1) {
      // Sin cierre: tratar como texto normal
      result.push({ type: "text", content: remaining.slice(boldStart) });
      break;
    }

    // Extraer el texto en negrita
    const boldContent = remaining.slice(boldStart + 2, boldEnd);
    if (boldContent) {
      result.push({ type: "bold", content: boldContent });
    }

    remaining = remaining.slice(boldEnd + 2);
  }

  return result;
}

// MARK: Renderer

interface MarkdownElementProps {
  element: MarkdownElement;
}

function MarkdownElement({ element }: MarkdownElementProps) {
  if (element.type === "paragraph") {
    return (
      <p className="m-0 leading-[1.45]">
        <TextContent content={element.content} />
      </p>
    );
  }

  if (element.type === "list") {
    return (
      <ul className="m-0 space-y-1 pl-5">
        {groupListItems(element.items).map((item, i) => (
          <li key={i} className="leading-[1.45]">
            <TextContent content={item} />
          </li>
        ))}
      </ul>
    );
  }

  return null;
}

/**
 * Agrupa los items de lista, dividiendo por saltos de línea.
 */
function groupListItems(items: (TextSpan | TextNode)[]): (TextSpan | TextNode)[][] {
  const groups: (TextSpan | TextNode)[][] = [];
  let current: (TextSpan | TextNode)[] = [];

  items.forEach((item) => {
    if (item.type === "linebreak") {
      if (current.length > 0) {
        groups.push(current);
        current = [];
      }
    } else {
      current.push(item);
    }
  });

  if (current.length > 0) {
    groups.push(current);
  }

  return groups;
}

interface TextContentProps {
  content: (TextSpan | TextNode)[];
}

function TextContent({ content }: TextContentProps) {
  return (
    <>
      {content.map((span, i) => {
        if (span.type === "text") {
          return <span key={i}>{span.content}</span>;
        }
        if (span.type === "bold") {
          return <strong key={i}>{span.content}</strong>;
        }
        if (span.type === "linebreak") {
          return <br key={i} />;
        }
        return null;
      })}
    </>
  );
}
