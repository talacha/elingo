import { NextRequest, NextResponse } from "next/server";
import { refreshSupabaseSession } from "@/lib/supabase/middleware";
import { getEnv } from "@/lib/env";
import { getRepo } from "@/lib/db";

/**
 * Proxy (Next.js 16; formerly "middleware") that runs on every request to
 * refresh the Supabase session and enforce auth requirements.
 * Gracefully handles the case where Supabase is not configured.
 */
export async function proxy(request: NextRequest) {
  const { response, supabase } = await refreshSupabaseSession(request);
  const env = getEnv();
  const pathname = request.nextUrl.pathname;

  // /admin always requires a logged-in admin, regardless of AUTH_REQUIRED (that flag governs
  // the anonymous-by-default chat experience; the admin dashboard is never anonymous-friendly).
  // Per Next's own guidance, this is defense in depth, not the only check -- each admin route
  // re-verifies role server-side too, since a proxy matcher change could otherwise silently
  // remove this coverage.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const user = supabase ? (await supabase.auth.getUser()).data.user : null;
    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    const record = await getRepo().upsertUserFromSupabase({ supabaseUserId: user.id });
    if (record.role !== "admin") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return response;
  }

  // If AUTH_REQUIRED is true, check for authenticated user
  if (env.AUTH_REQUIRED) {
    const user = supabase ? (await supabase.auth.getUser()).data.user : null;

    if (!user) {
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
