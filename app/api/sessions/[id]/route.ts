import { cookies } from "next/headers";
import { z } from "zod";
import { ANON_COOKIE } from "@/lib/contracts/chat";
import type { SessionDetailResponse } from "@/lib/contracts/sessions";
import { getRepo } from "@/lib/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Validate the session ID from the URL parameter
const sessionIdSchema = z.string().uuid();

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await params;

    // Validate session ID format
    const parsed = sessionIdSchema.safeParse(id);
    if (!parsed.success) {
      return Response.json(
        { error: "invalid_request", message: "ID de sesión inválido" },
        { status: 404 }
      );
    }

    const repo = getRepo();

    // Try to get authenticated user first
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        // User is authenticated - return their session by user_id
        const user = await repo.upsertUserFromSupabase({
          supabaseUserId: data.user.id,
          displayName: data.user.user_metadata?.display_name,
        });
        const detail = await repo.getSession(id, { userId: user.id });
        if (detail) {
          const response: SessionDetailResponse = detail;
          return Response.json(response, { status: 200 });
        }
        // User authenticated but session doesn't belong to them
        return Response.json(
          { error: "not_found", message: "Sesión no encontrada" },
          { status: 404 }
        );
      }
    }

    // Fall back to anonymous sessions via cookie
    const cookieStore = await cookies();
    const anonId = cookieStore.get(ANON_COOKIE)?.value;

    // No cookie = 404 (don't leak whether the session exists to unauthenticated users)
    if (!anonId) {
      return Response.json(
        { error: "not_found", message: "Sesión no encontrada" },
        { status: 404 }
      );
    }

    // Validate anonId is a valid UUID
    const uuidSchema = z.string().uuid();
    const anonIdParsed = uuidSchema.safeParse(anonId);
    if (!anonIdParsed.success) {
      return Response.json(
        { error: "invalid_cookie", message: "Cookie inválida" },
        { status: 400 }
      );
    }

    const detail = await repo.getSession(id, { anonId });

    // 404 if session doesn't exist or doesn't belong to the caller
    if (!detail) {
      return Response.json(
        { error: "not_found", message: "Sesión no encontrada" },
        { status: 404 }
      );
    }

    const response: SessionDetailResponse = detail;
    return Response.json(response, { status: 200 });
  } catch (error) {
    console.error("GET /api/sessions/[id] error:", error);
    return Response.json(
      { error: "internal_error", message: "Error al obtener sesión" },
      { status: 500 }
    );
  }
}
