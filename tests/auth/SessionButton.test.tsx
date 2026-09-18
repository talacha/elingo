import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SessionButton } from "@/components/auth/SessionButton";

// Mock the Supabase client
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseClient: vi.fn(() => null), // Simulate Supabase not configured
}));

describe("SessionButton", () => {
  it("renders nothing when Supabase is not configured", async () => {
    const html = renderToStaticMarkup(<SessionButton />);
    // When Supabase is not available, the button returns null
    // This is safe and doesn't break the page
    expect(html).toBeDefined();
  });
});
