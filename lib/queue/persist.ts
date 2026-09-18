import type { PersistJob } from "@/lib/contracts/queue";
import { getRepo } from "@/lib/db";

/**
 * Persists a job to the database (Neon or memory).
 * Idempotent: safe to call multiple times with the same job.
 * Uses message.id as the unique constraint to handle duplicates.
 */
export async function persistJob(job: PersistJob): Promise<void> {
  const repo = getRepo();

  // Upsert session (idempotent by id)
  await repo.upsertSession({
    id: job.sessionId,
    userId: job.userId,
    anonId: job.anonId,
    subject: job.subject,
    // Title is derived from the first user message (optional, not overwritten)
    title: undefined,
  });

  // Insert messages (idempotent by on conflict do nothing on id)
  const newMessages = job.messages.map((msg) => ({
    id: msg.id,
    sessionId: job.sessionId,
    role: msg.role as "user" | "assistant" | "system",
    content: msg.content,
    tokensIn: msg.tokensIn,
    tokensOut: msg.tokensOut,
    model: msg.model,
    createdAt: msg.createdAt,
  }));

  await repo.insertMessages(newMessages);
}
