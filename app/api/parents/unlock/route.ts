import { NextRequest, NextResponse } from "next/server";
import { unlockRequestSchema, PARENT_UNLOCK_COOKIE } from "@/lib/contracts/parents";
import { verifySafeWord } from "@/lib/auth/safeWord";
import { createUnlockToken } from "@/lib/auth/parentUnlock";
import { getRepo } from "@/lib/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "unauthorized", message: "Necesitas iniciar sesión." },
        { status: 401 }
      );
    }

    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      return NextResponse.json(
        { error: "unauthorized", message: "Necesitas iniciar sesión." },
        { status: 401 }
      );
    }

    const repo = getRepo();
    const user = await repo.upsertUserFromSupabase({
      supabaseUserId: data.user.id,
      displayName: data.user.user_metadata?.display_name,
    });

    const security = await repo.getUserSecurity(user.id);
    if (!security || security.safeWordHash === null) {
      return NextResponse.json(
        { error: "needs_safe_word", message: "Todavía no has fijado tu palabra segura." },
        { status: 409 }
      );
    }

    const body = await req.json();
    const parsed = unlockRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_request", message: "Cuerpo inválido." },
        { status: 400 }
      );
    }

    const isValid = await verifySafeWord(parsed.data.safeWord, security.safeWordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "unauthorized", message: "Palabra segura incorrecta." },
        { status: 401 }
      );
    }

    const token = await createUnlockToken(user.id);
    const response = NextResponse.json({ ok: true }, { status: 200 });
    response.cookies.set(PARENT_UNLOCK_COOKIE, token, {
      httpOnly: true,
      maxAge: 4 * 60 * 60,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch (error) {
    console.error("[parents/unlock] Error:", error);
    return NextResponse.json(
      { error: "upstream_error", message: "Error al procesar tu solicitud. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
