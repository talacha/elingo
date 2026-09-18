import { describe, expect, it } from "vitest";

// These are client components that are rendered on the browser side.
// Import them to ensure they exist and can be loaded without errors.
import { ParentsDashboard } from "@/components/parents/ParentsDashboard";

describe("Parents Components", () => {
  it("ParentsDashboard component exists", () => {
    expect(ParentsDashboard).toBeDefined();
    expect(typeof ParentsDashboard).toBe("function");
  });
});
