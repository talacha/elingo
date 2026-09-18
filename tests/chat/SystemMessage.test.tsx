import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SystemMessage } from "@/components/chat/SystemMessage";

describe("SystemMessage", () => {
  it("displays the model name", () => {
    const html = renderToStaticMarkup(<SystemMessage model="claude-fable-5-1" />);
    expect(html).toContain("claude-fable-5-1");
    expect(html).toContain("Hola, soy ELI");
  });

  it("shows 'desconocido' when model is null", () => {
    const html = renderToStaticMarkup(<SystemMessage model={null} />);
    expect(html).toContain("desconocido");
  });

  it("has proper accessibility labels with sr-only", () => {
    const html = renderToStaticMarkup(<SystemMessage model="mock" />);
    expect(html).toContain("sr-only");
    expect(html).toContain("ELI:");
  });

  it("handles different model names correctly", () => {
    const models = ["claude-fable-5-1", "deepseek-v4", "mock"];
    for (const model of models) {
      const html = renderToStaticMarkup(<SystemMessage model={model} />);
      expect(html).toContain(model);
      expect(html).toContain("Hola, soy ELI");
    }
  });

  it("includes correct structure for ELI avatar", () => {
    const html = renderToStaticMarkup(<SystemMessage model="test-model" />);
    // Check for list item
    expect(html).toContain("<li");
    // Check for grid layout classes
    expect(html).toContain("grid-cols-");
  });
});
