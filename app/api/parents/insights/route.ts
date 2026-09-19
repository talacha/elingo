import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getRepo } from "@/lib/db";
import { PARENT_UNLOCK_COOKIE, type ParentInsightsResponse } from "@/lib/contracts/parents";
import { verifyUnlockToken } from "@/lib/auth/parentUnlock";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
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
    const userId = user.id;

    const unlockToken = req.cookies.get(PARENT_UNLOCK_COOKIE)?.value;
    const isUnlocked = await verifyUnlockToken(unlockToken, userId);
    if (!isUnlocked) {
      return NextResponse.json(
        { error: "unauthorized", message: "Necesitas desbloquear /parents primero." },
        { status: 401 }
      );
    }

    const security = await repo.getUserSecurity(userId);
    if (!security) {
      return NextResponse.json(
        { error: "upstream_error", message: "Error al procesar tu solicitud. Intenta de nuevo." },
        { status: 500 }
      );
    }

    const activity = await repo.getActivityInsight(userId);

    const response: ParentInsightsResponse = {
      hasSafeWord: security.safeWordHash !== null,
      settings: {
        allowImages: security.allowImages,
        allowVoice: security.allowVoice,
        allowText: security.allowText,
      },
      activity,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("[parents/insights] Error:", error);
    return NextResponse.json(
      { error: "upstream_error", message: "Error al procesar tu solicitud. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
