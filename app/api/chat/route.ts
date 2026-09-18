import { NextRequest } from "next/server";
import { chatRequestSchema } from "@/lib/contracts/chat";
import { checkRateLimit } from "@/lib/ratelimit";
import { streamTutorReply } from "@/lib/ai/service";
import { enqueuePersist } from "@/lib/queue";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = chatRequestSchema.safeParse(body);
    
    if (!parsed.success) {
      return Response.json(
        { error: "invalid_request", message: "Cuerpo inválido", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { sessionId, subject, messages } = parsed.data;
    
    // Rate limit check
    const key = sessionId;
    const limit = await checkRateLimit(key);
    if (!limit.ok) {
      return Response.json(
        {
          error: "rate_limited",
          message: "Demasiadas peticiones. Intenta más tarde.",
          retryAfter: Math.ceil((limit.resetAt - Date.now()) / 1000),
        },
        { status: 429, headers: { "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } }
      );
    }

    // Stream the AI response
    const { stream, done } = await streamTutorReply({ sessionId, messages, subject });

    // Prepare response headers
    const response = new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "x-session-id": sessionId,
      },
    });

    // Fire-and-forget: persist to DB after streaming completes
    done.then((result) => {
      void enqueuePersist({
        sessionId,
        subject,
        messages: [
          ...messages,
          { id: crypto.randomUUID(), role: "assistant", content: "", tokensIn: result.usage.inputTokens, tokensOut: result.usage.outputTokens, model: result.model },
        ],
      });
    }).catch(console.error);

    return response;
  } catch (error) {
    console.error("Chat error:", error);
    return Response.json(
      { error: "upstream_error", message: "Error al procesar tu solicitud. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
