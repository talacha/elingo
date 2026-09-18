import { afterEach, describe, expect, it } from "vitest";
import { getEnv, resetEnvCache } from "@/lib/env";

const ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_ELI_SUPABASE_URL",
  "NEXT_PUBLIC_ELI_SUPABASE_ANON_KEY",
  "ELI_SUPABASE_URL",
  "ELI_SUPABASE_ANON_KEY",
  "ELI_SUPABASE_SERVICE_ROLE_KEY",
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
  resetEnvCache();
}

afterEach(() => {
  apply(saved);
});

describe("getEnv Supabase fallback (N-T030-2)", () => {
  it("uses the plain names when set, ignoring the ELI_-prefixed ones", () => {
    apply({
      NEXT_PUBLIC_SUPABASE_URL: "https://plain.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "plain-anon",
      NEXT_PUBLIC_ELI_SUPABASE_URL: "https://eli-prefixed.supabase.co",
      NEXT_PUBLIC_ELI_SUPABASE_ANON_KEY: "eli-anon",
    });
    const env = getEnv();
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://plain.supabase.co");
    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe("plain-anon");
  });

  it("falls back to NEXT_PUBLIC_ELI_SUPABASE_* when the plain names are unset", () => {
    apply({
      NEXT_PUBLIC_ELI_SUPABASE_URL: "https://eli-prefixed.supabase.co",
      NEXT_PUBLIC_ELI_SUPABASE_ANON_KEY: "eli-anon",
    });
    const env = getEnv();
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://eli-prefixed.supabase.co");
    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe("eli-anon");
  });

  it("falls back to the un-prefixed ELI_SUPABASE_* as a last resort", () => {
    apply({
      ELI_SUPABASE_URL: "https://eli-server-only.supabase.co",
      ELI_SUPABASE_ANON_KEY: "eli-server-anon",
      ELI_SUPABASE_SERVICE_ROLE_KEY: "eli-service-role",
    });
    const env = getEnv();
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://eli-server-only.supabase.co");
    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe("eli-server-anon");
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBe("eli-service-role");
  });

  it("stays undefined when nothing is configured (anonymous mode)", () => {
    apply({});
    const env = getEnv();
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBeUndefined();
    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBeUndefined();
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
  });
});
