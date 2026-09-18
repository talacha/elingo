import { createBrowserClient } from "@supabase/ssr";
import { getEnv } from "@/lib/env";

/**
 * Creates a Supabase client for use in the browser.
 * Returns null if Supabase env vars are not configured (graceful degradation).
 */
export function createSupabaseClient() {
  const env = getEnv();

  // Gracefully degrade if Supabase is not configured
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null;
  }

  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
