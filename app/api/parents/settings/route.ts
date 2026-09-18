import { NextRequest, NextResponse } from "next/server";
import { parentSettingsSchema, PARENT_UNLOCK_COOKIE } from "@/lib/contracts/parents";
import { verifyUnlockToken } from "@/lib/auth/parentUnlock";
import { getRepo } from "@/lib/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

async function getAuthenticatedUser() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return null;
  }

  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return null;
  }

  return data.user;
}

async function verifyUnlock(req: NextRequest, userId: string): Promise<boolean> {
  const token = req.cookies.get(PARENT_UNLOCK_COOKIE)?.value;
  return verifyUnlockToken(token, userId);
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: "unauthorized", message: "Necesitas iniciar sesión." },
        { status: 401 }
      );
    }

    const repo = getRepo();
    const userRecord = await repo.upsertUserFromSupabase({
      supabaseUserId: user.id,
      displayName: user.user_metadata?.display_name,
    });

    const isUnlocked = await verifyUnlock(req, userRecord.id);
    if (!isUnlocked) {
      return NextResponse.json(
        { error: "unauthorized", message: "Necesitas desbloquear /parents primero." },
        { status: 401 }
      );
    }

    const security = await repo.getUserSecurity(userRecord.id);
    if (!security) {
      return NextResponse.json(
        { error: "upstream_error", message: "Error al procesar tu solicitud. Intenta de nuevo." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        allowImages: security.allowImages,
        allowVoice: security.allowVoice,
        allowText: security.allowText,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[parents/settings] GET error:", error);
    return NextResponse.json(
      { error: "upstream_error", message: "Error al procesar tu solicitud. Intenta de nuevo." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: "unauthorized", message: "Necesitas iniciar sesión." },
        { status: 401 }
      );
    }

    const repo = getRepo();
    const userRecord = await repo.upsertUserFromSupabase({
      supabaseUserId: user.id,
      displayName: user.user_metadata?.display_name,
    });

    const isUnlocked = await verifyUnlock(req, userRecord.id);
    if (!isUnlocked) {
      return NextResponse.json(
        { error: "unauthorized", message: "Necesitas desbloquear /parents primero." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const parsed = parentSettingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_request", message: "Cuerpo inválido." },
        { status: 400 }
      );
    }

    const updated = await repo.updateUserFlags(userRecord.id, parsed.data);

    return NextResponse.json(
      {
        allowImages: updated.allowImages,
        allowVoice: updated.allowVoice,
        allowText: updated.allowText,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[parents/settings] PATCH error:", error);
    return NextResponse.json(
      { error: "upstream_error", message: "Error al procesar tu solicitud. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
