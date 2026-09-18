import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getEnv } from "@/lib/env";

/**
 * Creates a Supabase client for use in server components and route handlers.
 * Handles cookie-based session management for Next.js App Router.
 * Returns null if Supabase env vars are not configured (graceful degradation).
 */
export async function createSupabaseServerClient() {
  const env = getEnv();

  // Gracefully degrade if Supabase is not configured
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing the user's session.
          }
        },
      },
    }
  );
}
