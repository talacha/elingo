import { NextRequest, NextResponse, after } from "next/server";
import { chatRequestSchema, ANON_COOKIE, CHAT_HEADERS } from "@/lib/contracts/chat";
import { checkRateLimit } from "@/lib/ratelimit";
import { streamTutorReply } from "@/lib/ai/service";
import { enqueuePersist } from "@/lib/queue";
import { getEnv, resolveProvider } from "@/lib/env";
import { createChatLogEvent, logChatEvent } from "@/lib/ai/log";
import { getProvider } from "@/lib/ai/providers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getRepo } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60;

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
    const parsed = chatRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_request", message: "Cuerpo inválido", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { sessionId, subject, messages } = parsed.data;
    const env = getEnv();

    // Input cost guard: check last message length
    const lastMessage = messages.at(-1);
    if (lastMessage && lastMessage.content.length > env.AI_MAX_INPUT_CHARS) {
      return NextResponse.json(
        {
          error: "invalid_request",
          message: `Tu mensaje es demasiado largo. Usa menos de ${env.AI_MAX_INPUT_CHARS} caracteres.`,
        },
        { status: 400 }
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

    // Get or create the anonymous cookie
    let anonId = req.cookies.get(ANON_COOKIE)?.value;
    let setCookie = false;
    if (!anonId) {
      anonId = crypto.randomUUID();
      setCookie = true;
    }

    // Rate limit key: userId ?? anonId ?? ip
    const rateLimitKey = userId || anonId || getClientIp(req);
    const limit = await checkRateLimit(rateLimitKey);
    if (!limit.ok) {
      const response = NextResponse.json(
        {
          error: "rate_limited",
          message: "Demasiadas peticiones. Intenta más tarde.",
          retryAfter: Math.ceil((limit.resetAt - Date.now()) / 1000),
        },
        { status: 429, headers: { "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } }
      );
      if (setCookie) {
        response.cookies.set(ANON_COOKIE, anonId, {
          httpOnly: true,
          maxAge: 365 * 24 * 60 * 60, // 1 year in seconds
          path: "/",
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
        });
      }
      return response;
    }

    // Stream the AI response
    const { stream, done } = await streamTutorReply({ sessionId, messages, subject });

    // Get the provider and model upfront for the header
    const provider = resolveProvider(env);
    const providerInstance = getProvider(env);
    const modelName = providerInstance.model;

    // Create streaming response with proper headers
    const response = new NextResponse(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        [CHAT_HEADERS.sessionId]: sessionId,
        [CHAT_HEADERS.provider]: provider,
        [CHAT_HEADERS.model]: modelName,
      },
    });

    // Set the anonymous cookie if it was newly created
    if (setCookie) {
      response.cookies.set(ANON_COOKIE, anonId, {
        httpOnly: true,
        maxAge: 365 * 24 * 60 * 60, // 1 year in seconds
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    }

    // Schedule persistence work to run after response is sent
    after(async () => {
      try {
        // Log the chat event (no PII)
        const result = await done;
        const logEvent = createChatLogEvent(sessionId, provider, result);
        logChatEvent(logEvent);

        // Persist the full message history with userId or anonId
        await enqueuePersist({
          sessionId,
          userId,
          anonId,
          subject,
          messages: [
            ...messages,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: "",
              tokensIn: result.usage.inputTokens,
              tokensOut: result.usage.outputTokens,
              model: result.model,
            },
          ],
        });
      } catch (error) {
        console.error("[chat] Failed to persist session:", error);
      }
    });

    return response;
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json(
      { error: "upstream_error", message: "Error al procesar tu solicitud. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
