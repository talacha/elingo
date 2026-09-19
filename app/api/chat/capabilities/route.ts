import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getEffectiveFlags } from "@/lib/config/flags";
import { getRepo } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Qué partes de la interfaz de chat se muestran. `allowVoice` ← flag `voice_mode`, `allowImages` ←
 * flag `image_mode` (global Y de la cuenta, ver lib/config/flags.ts); `allowText` sigue siendo el
 * interruptor de /parents.
 */
export interface ChatCapabilities {
  allowImages: boolean;
  allowVoice: boolean;
  allowText: boolean;
}

export async function GET() {
  // Por defecto todo activo (anónima o si falla una lectura): nunca bloquea el chat por un fallo.
  const defaults: ChatCapabilities = { allowImages: true, allowVoice: true, allowText: true };

  try {
    const supabase = await createSupabaseServerClient();
    const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

    // Sin sesión solo cuenta el flag global; con sesión, también el de la cuenta.
    let userId: string | undefined;
    let allowText = true;
    if (data.user) {
      const repo = getRepo();
      const user = await repo.upsertUserFromSupabase({
        supabaseUserId: data.user.id,
        displayName: data.user.user_metadata?.display_name,
      });
      userId = user.id;
      allowText = (await repo.getUserSecurity(user.id))?.allowText ?? true;
    }

    const flags = await getEffectiveFlags(userId);
    return NextResponse.json(
      { allowImages: flags.image_mode, allowVoice: flags.voice_mode, allowText },
      { status: 200 },
    );
  } catch (error) {
    console.error("[chat/capabilities] Failed to fetch user capabilities:", error);
    return NextResponse.json(defaults, { status: 200 });
  }
}
