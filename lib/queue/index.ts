import type { PersistJob } from "@/lib/contracts/queue";
import { persistJob } from "./persist";
import { getEnv } from "@/lib/env";

/**
 * Enqueues a persistence job via QStash (if token is available) or inline (fallback).
 * With QSTASH_TOKEN: publishes to ${NEXT_PUBLIC_APP_URL}/api/jobs/persist with deduplication.
 * Without QSTASH_TOKEN: executes persistJob inline (fallback for dev/testing without QStash).
 * Idempotent by last message id.
 */
export async function enqueuePersist(job: PersistJob): Promise<void> {
  const env = getEnv();

  if (!env.QSTASH_TOKEN) {
    // Fallback: persist inline
    await persistJob(job);
    return;
  }

  // With QStash token: publish to the persist endpoint
  const { Client } = await import("@upstash/qstash");
  const client = new Client({ token: env.QSTASH_TOKEN });

  const lastMessage = job.messages.at(-1);
  const deduplicationId = lastMessage?.id || job.sessionId;

  await client.publishJSON({
    url: `${env.NEXT_PUBLIC_APP_URL}/api/jobs/persist`,
    body: job,
    deduplicationId,
  });
}
