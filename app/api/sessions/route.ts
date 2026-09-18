import { cookies } from "next/headers";
import { z } from "zod";
import { ANON_COOKIE } from "@/lib/contracts/chat";
import type { SessionsListResponse } from "@/lib/contracts/sessions";
import { getRepo } from "@/lib/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    const repo = getRepo();

    // Try to get authenticated user first
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        // User is authenticated - return their sessions by user_id
        const user = await repo.upsertUserFromSupabase({
          supabaseUserId: data.user.id,
          displayName: data.user.user_metadata?.display_name,
        });
        const sessions = await repo.listSessions({ userId: user.id });
        const response: SessionsListResponse = { sessions };
        return Response.json(response, { status: 200 });
      }
    }

    // Fall back to anonymous sessions via cookie
    const cookieStore = await cookies();
    const anonId = cookieStore.get(ANON_COOKIE)?.value;

    // No cookie = empty sessions list (don't error, don't set a new cookie)
    if (!anonId) {
      const response: SessionsListResponse = { sessions: [] };
      return Response.json(response, { status: 200 });
    }

    // Validate that anonId is a valid UUID (defensive check, cookie should already be UUID)
    const uuidSchema = z.string().uuid();
    const parsed = uuidSchema.safeParse(anonId);
    if (!parsed.success) {
      return Response.json(
        { error: "invalid_cookie", message: "Cookie inválida" },
        { status: 400 }
      );
    }

    const sessions = await repo.listSessions({ anonId });

    const response: SessionsListResponse = { sessions };
    return Response.json(response, { status: 200 });
  } catch (error) {
    console.error("GET /api/sessions error:", error);
    return Response.json(
      { error: "internal_error", message: "Error al obtener sesiones" },
      { status: 500 }
    );
  }
}
