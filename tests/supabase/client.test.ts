import { afterEach, describe, expect, it } from "vitest";
import { createSupabaseClient } from "@/lib/supabase/client";

const ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_ELI_SUPABASE_URL",
  "NEXT_PUBLIC_ELI_SUPABASE_ANON_KEY",
] as const;
type EnvKey = (typeof ENV_KEYS)[number];

const saved: Partial<Record<EnvKey, string>> = {};
for (const key of ENV_KEYS) saved[key] = process.env[key];

function apply(values: Partial<Record<EnvKey, string>>) {
  for (const key of ENV_KEYS) {
    const value = values[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

afterEach(() => {
  apply(saved);
});

// createSupabaseClient() reads process.env.NEXT_PUBLIC_* literally (not via getEnv()) --
// see the comment in lib/supabase/client.ts and tasks.md's N-T030-2. These tests exercise
// the runtime fallback logic; they can't verify Next.js's build-time inlining of literal
// process.env.NEXT_PUBLIC_X references itself (that's a build-time guarantee documented at
// https://nextjs.org/docs/app/guides/environment-variables#bundling-environment-variables-for-the-browser).
describe("createSupabaseClient", () => {
  it("returns null when nothing is configured (anonymous mode)", () => {
    apply({});
    expect(createSupabaseClient()).toBeNull();
  });

  it("returns a client using the plain NEXT_PUBLIC_SUPABASE_* names", () => {
    apply({
      NEXT_PUBLIC_SUPABASE_URL: "https://plain.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "plain-anon",
    });
    expect(createSupabaseClient()).not.toBeNull();
  });

  it("falls back to NEXT_PUBLIC_ELI_SUPABASE_* when the plain names are unset", () => {
    apply({
      NEXT_PUBLIC_ELI_SUPABASE_URL: "https://eli-prefixed.supabase.co",
      NEXT_PUBLIC_ELI_SUPABASE_ANON_KEY: "eli-anon",
    });
    expect(createSupabaseClient()).not.toBeNull();
  });

  it("stays null if only one of the two values is present", () => {
    apply({ NEXT_PUBLIC_SUPABASE_URL: "https://plain.supabase.co" });
    expect(createSupabaseClient()).toBeNull();
  });
});
