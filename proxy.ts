import { NextRequest, NextResponse } from "next/server";
import { refreshSupabaseSession } from "@/lib/supabase/middleware";
import { getEnv } from "@/lib/env";

/**
 * Proxy (Next.js 16; formerly "middleware") that runs on every request to
 * refresh the Supabase session and enforce auth requirements.
 * Gracefully handles the case where Supabase is not configured.
 */
export async function proxy(request: NextRequest) {
  const { response, supabase } = await refreshSupabaseSession(request);
  const env = getEnv();

  // If AUTH_REQUIRED is true, check for authenticated user
  if (env.AUTH_REQUIRED) {
    const user = supabase ? (await supabase.auth.getUser()).data.user : null;

    if (!user) {
      const pathname = request.nextUrl.pathname;

      // Redirect /chat and /chat/* page requests to /login
      if (pathname === "/chat" || pathname.startsWith("/chat/")) {
        return NextResponse.redirect(new URL("/login", request.url));
      }

      // Return 401 for API requests (except /api/jobs/* which has QStash signature verification)
      if (pathname.startsWith("/api/") && !pathname.startsWith("/api/jobs/")) {
        return NextResponse.json({ error: "unauthorized", message: "Autenticación requerida" }, { status: 401 });
      }
    }
  }

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
