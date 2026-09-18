import { NextRequest } from "next/server";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { persistJobSchema } from "@/lib/contracts/queue";
import { persistJob } from "@/lib/queue/persist";
import { getEnv } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/jobs/persist
 *
 * QStash endpoint that receives and processes persist jobs.
 * Verifies the QStash signature before processing.
 * Idempotent: safe to retry.
 */
async function handler(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = persistJobSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "invalid_request", message: "Cuerpo inválido", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    await persistJob(parsed.data);

    return Response.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("Persist job error:", error);
    return Response.json(
      { error: "persist_error", message: "Failed to process persist job" },
      { status: 500 }
    );
  }
}

const env = getEnv();

// Wrap with signature verification if we have QStash keys configured
export const POST = env.QSTASH_CURRENT_SIGNING_KEY
  ? verifySignatureAppRouter(handler, {
      currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
      nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY,
    })
  : handler;
