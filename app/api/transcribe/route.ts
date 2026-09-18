import { NextRequest, NextResponse } from "next/server";
import { transcribeRequestSchema } from "@/lib/contracts/media";
import { checkRateLimit } from "@/lib/ratelimit";
import { transcribeAudio } from "@/lib/ai/transcribe";
import { ANON_COOKIE } from "@/lib/contracts/chat";
import { chatErrorResponse } from "@/lib/http/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getRepo } from "@/lib/db";

export const runtime = "nodejs";

/** Extract client IP from x-forwarded-for header or return a fallback. */
function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  // Fallback for local development
  return "127.0.0.1";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = transcribeRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        ...chatErrorResponse("invalid_request", "Cuerpo inválido", 400, {
          issues: parsed.error.issues,
        })
      );
    }

    // Get authenticated user from Supabase if available
    const supabase = await createSupabaseServerClient();
    let userId: string | undefined;
    if (supabase) {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        const repo = getRepo();
        const user = await repo.upsertUserFromSupabase({
          supabaseUserId: data.user.id,
          displayName: data.user.user_metadata?.display_name,
        });
        userId = user.id;
      }
    }

    // Enforce voice restrictions: if user is authenticated and disallows voice,
    // return 204 (same as no API key), so client fallback handling applies.
    if (userId) {
      try {
        const repo = getRepo();
        const security = await repo.getUserSecurity(userId);
        if (security && !security.allowVoice) {
          return new NextResponse(null, { status: 204 });
        }
      } catch (error) {
        // Log error but proceed gracefully (permissive default)
        console.error("[transcribe] Failed to check user security flags:", error);
      }
    }

    // Get or use existing anonymous cookie for rate limiting
    const anonCookieValue = req.cookies.get(ANON_COOKIE)?.value;
    const rateLimitKey = anonCookieValue || getClientIp(req);
    const prefixedKey = `transcribe:${rateLimitKey}`;

    const limit = await checkRateLimit(prefixedKey);
    if (!limit.ok) {
      const retryAfter = Math.ceil((limit.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        ...chatErrorResponse("rate_limited", "Demasiadas peticiones. Intenta más tarde.", 429, {
          retryAfter,
        })
      );
    }

    const result = await transcribeAudio(parsed.data);

    if (result === null) {
      return new NextResponse(null, { status: 204 });
    }

    return NextResponse.json({ text: result }, { status: 200 });
  } catch (error) {
    console.error("Transcribe error:", error);
    return NextResponse.json(
      ...chatErrorResponse(
        "upstream_error",
        "Error al procesar tu solicitud. Intenta de nuevo.",
        500
      )
    );
  }
}
