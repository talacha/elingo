import { createBrowserClient } from "@supabase/ssr";

/**
 * Creates a Supabase client for use in the browser.
 * Returns null if Supabase env vars are not configured (graceful degradation).
 *
 * Reads process.env.NEXT_PUBLIC_* directly instead of going through lib/env.ts's
 * getEnv(): Next.js only inlines NEXT_PUBLIC_ values into the client bundle for
 * literal `process.env.NEXT_PUBLIC_X` references at each call site, not for a value
 * read off a dynamically-enumerated process.env object like getEnv() builds -- see
 * https://nextjs.org/docs/app/guides/environment-variables#bundling-environment-variables-for-the-browser.
 * Falls back to the ELI_-prefixed names the Vercel Supabase integration installs
 * (same situation as Neon's eli_DATABASE_URL, see tasks.md's N-010).
 */
export function createSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_ELI_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_ELI_SUPABASE_ANON_KEY;

  // Gracefully degrade if Supabase is not configured
  if (!url || !anonKey) {
    return null;
  }

  return createBrowserClient(url, anonKey);
}
