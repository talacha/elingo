import { NextRequest } from "next/server";
import { refreshSupabaseSession } from "@/lib/supabase/middleware";

/**
 * Proxy (Next.js 16; formerly "middleware") that runs on every request to
 * refresh the Supabase session. Gracefully handles the case where Supabase
 * is not configured.
 */
export async function proxy(request: NextRequest) {
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
