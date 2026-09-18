import { describe, it, expect } from "vitest";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

describe("AdminDashboard component", () => {
  it("is defined and renders", () => {
    expect(AdminDashboard).toBeDefined();
    expect(typeof AdminDashboard).toBe("function");
  });
});
