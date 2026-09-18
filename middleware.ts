import { NextRequest } from "next/server";
import { refreshSupabaseSession } from "@/lib/supabase/middleware";

/**
 * Middleware that runs on every request to refresh the Supabase session.
 * Gracefully handles the case where Supabase is not configured.
 */
export async function middleware(request: NextRequest) {
  const { response } = await refreshSupabaseSession(request);
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.svg).*)",
  ],
};
