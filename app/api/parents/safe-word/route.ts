import { NextRequest, NextResponse } from "next/server";
import { setSafeWordRequestSchema } from "@/lib/contracts/parents";
import { hashSafeWord } from "@/lib/auth/safeWord";
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

    const body = await req.json();
    const parsed = setSafeWordRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_request", message: "Cuerpo inválido." },
        { status: 400 }
      );
    }

    const repo = getRepo();
    const user = await repo.upsertUserFromSupabase({
      supabaseUserId: data.user.id,
      displayName: data.user.user_metadata?.display_name,
    });

    const hash = await hashSafeWord(parsed.data.safeWord);
    await repo.setSafeWordHash(user.id, hash);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("[parents/safe-word] Error:", error);
    return NextResponse.json(
      { error: "upstream_error", message: "Error al procesar tu solicitud. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
