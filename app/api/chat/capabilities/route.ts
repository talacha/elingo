import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getRepo } from "@/lib/db";

export const runtime = "nodejs";

export interface ChatCapabilities {
  allowImages: boolean;
  allowVoice: boolean;
  allowText: boolean;
}

export async function GET() {
  // Default: all capabilities enabled (for anonymous users or if lookups fail)
  const defaultCapabilities: ChatCapabilities = {
    allowImages: true,
    allowVoice: true,
    allowText: true,
  };

  try {
    // Get authenticated user from Supabase if available
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      // No Supabase client: return all-true (anonymous)
      return NextResponse.json(defaultCapabilities, { status: 200 });
    }

    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      // Not authenticated: return all-true (anonymous)
      return NextResponse.json(defaultCapabilities, { status: 200 });
    }

    // User is authenticated: get their security flags
    const repo = getRepo();
    const user = await repo.upsertUserFromSupabase({
      supabaseUserId: data.user.id,
      displayName: data.user.user_metadata?.display_name,
    });

    const security = await repo.getUserSecurity(user.id);
    if (security) {
      return NextResponse.json(
        {
          allowImages: security.allowImages,
          allowVoice: security.allowVoice,
          allowText: security.allowText,
        },
        { status: 200 }
      );
    }

    // Security record not found: return all-true (permissive default)
    return NextResponse.json(defaultCapabilities, { status: 200 });
  } catch (error) {
    // Any error during lookup: log and return all-true (permissive default, never blocks)
    console.error("[chat/capabilities] Failed to fetch user capabilities:", error);
    return NextResponse.json(defaultCapabilities, { status: 200 });
  }
}
