import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";

/**
 * Middleware helper to refresh Supabase session on each request.
 * Returns the response and the Supabase client (or null if not configured).
 * Gracefully degrades if Supabase env vars are not set.
 */
export async function refreshSupabaseSession(request: NextRequest) {
  const env = getEnv();

  // Gracefully degrade if Supabase is not configured
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { response: NextResponse.next(), supabase: null };
  }

  const response = NextResponse.next();

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session to ensure it's valid (this sets/updates cookies if needed)
  await supabase.auth.getSession();

  return { response, supabase };
}
