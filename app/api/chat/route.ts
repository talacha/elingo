import { NextRequest, NextResponse, after } from "next/server";
import { chatRequestSchema, ANON_COOKIE, CHAT_HEADERS } from "@/lib/contracts/chat";
import { checkRateLimit } from "@/lib/ratelimit";
import { checkBudget, incrementBudget } from "@/lib/ai/budget";
import { streamTutorReply } from "@/lib/ai/service";
import { enqueuePersist } from "@/lib/queue";
import { getEnv } from "@/lib/env";
import { getEffectiveEnv } from "@/lib/config/effective";
import { getEffectiveFlags } from "@/lib/config/flags";
import { createChatLogEvent, logChatEvent } from "@/lib/ai/log";
import { getProviderWithOverrides } from "@/lib/ai/providers";
import { modelForRequest, type TutorTurn } from "@/lib/contracts/ai";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getRepo } from "@/lib/db";
import { chatErrorResponse } from "@/lib/http/errors";

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
        ...chatErrorResponse("invalid_request", "Cuerpo inválido", 400, {
          issues: parsed.error.issues,
        })
      );
    }

    const { sessionId, subject, messages } = parsed.data;
    const env = getEnv();
    // Config efectiva: env vars + lo guardado en Postgres desde /admin (vía Redis).
    const effectiveEnv = await getEffectiveEnv(env);
    const maxInputChars = effectiveEnv.AI_MAX_INPUT_CHARS;

    // Input cost guard: check last message length
    const lastMessage = messages.at(-1);
    if (lastMessage && lastMessage.content.length > maxInputChars) {
      return NextResponse.json(
        ...chatErrorResponse(
          "invalid_request",
          `Tu mensaje es demasiado largo. Usa menos de ${maxInputChars} caracteres.`,
          400
        )
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

    // Modo imagen (feature flag `image_mode`, global Y de la cuenta): con el flag apagado se rechazan
    // los mensajes con imagen antes de procesarlos. `getEffectiveFlags` nunca lanza (falla abierto).
    if (messages.at(-1)?.image) {
      const flags = await getEffectiveFlags(userId);
      if (!flags.image_mode) {
        return NextResponse.json(
          ...chatErrorResponse(
            "invalid_request",
            "Las imágenes están desactivadas ahora mismo. Si te acompaña alguien, pídele que lo revise en /parents.",
            400
          )
        );
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
      const retryAfter = Math.ceil((limit.resetAt - Date.now()) / 1000);
      const response = NextResponse.json(
        ...chatErrorResponse("rate_limited", "Demasiadas peticiones. Intenta más tarde.", 429, {
          retryAfter,
        })
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

    // Check daily token budget before calling the AI provider
    const budgetOk = await checkBudget();
    if (!budgetOk) {
      const response = NextResponse.json(
        ...chatErrorResponse(
          "budget_exhausted",
          "El presupuesto diario se agotó. Por favor, intenta mañana.",
          503
        )
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

    // T-050/T-051: la imagen viaja como `image` (singular) en el contrato de chat; el servicio de IA
    // espera `images` (array) en TutorTurn. Se convierte aquí, en la frontera entre ambos contratos.
    const tutorMessages: TutorTurn[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
      ...(m.image ? { images: [m.image] } : {}),
    }));

    // T-067: getProviderWithOverrides consulta primero la config en caliente de /admin; sin ningún
    // override activo, es exactamente getProvider(env) (mismo comportamiento que siempre).
    const providerInstance = await getProviderWithOverrides(env);

    // Stream the AI response
    const { stream, done } = await streamTutorReply(
      { sessionId, messages: tutorMessages, subject },
      { provider: providerInstance, windowPairs: effectiveEnv.AI_WINDOW_PAIRS },
    );

    // Get the provider and model upfront for the header (modelForRequest: el modelo de visión si
    // el último turno trae imagen y el proveedor lo define; si no, el modelo por defecto).
    const provider = providerInstance.name;
    const modelName = modelForRequest(providerInstance, { messages: tutorMessages });

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

        // Increment daily token budget
        const totalTokens = result.usage.inputTokens + result.usage.outputTokens;
        await incrementBudget(totalTokens);

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
      ...chatErrorResponse(
        "upstream_error",
        "Error al procesar tu solicitud. Intenta de nuevo.",
        500
      )
    );
  }
}
