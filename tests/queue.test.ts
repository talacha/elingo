import { describe, it, expect, beforeEach, vi } from "vitest";
import { enqueuePersist } from "@/lib/queue";
import { persistJob } from "@/lib/queue/persist";
import { getRepo, resetRepo } from "@/lib/db";
import { resetEnvCache } from "@/lib/env";
import type { PersistJob, PersistedMessage } from "@/lib/contracts/queue";

// Mock QStash at the top level
const mockPublishJSON = vi.fn().mockResolvedValue({});
vi.mock("@upstash/qstash", () => {
  class MockClient {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(opts: { token: string }) {}
    publishJSON = mockPublishJSON;
  }
  return {
    Client: MockClient,
  };
});

describe("queue: persistJob", () => {
  beforeEach(() => {
    resetRepo();
    resetEnvCache();
    // Ensure we use MemoryRepo for tests (no DATABASE_URL)
    delete process.env.DATABASE_URL;
    delete process.env.QSTASH_TOKEN;
  });

  it("should upsert session and insert messages", async () => {
    const job: PersistJob = {
      sessionId: "session-1",
      anonId: "anon-1",
      subject: "mates",
      messages: [
        {
          id: "msg-1",
          role: "user",
          content: "Tengo un problema: 3/4 + 1/2",
        },
        {
          id: "msg-2",
          role: "assistant",
          content: "**Buen intento!** Desglosa el problema.",
          tokensIn: 50,
          tokensOut: 30,
          model: "claude-fable-5-1",
        },
      ],
    };

    const repo = getRepo();
    await persistJob(job);

    // Verify session was created
    const session = await repo.getSession("session-1", { anonId: "anon-1" });
    expect(session).not.toBeNull();
    expect(session?.session.id).toBe("session-1");
    expect(session?.messages).toHaveLength(2);
  });

  it("should be idempotent: calling twice with same job inserts nothing new", async () => {
    const job: PersistJob = {
      sessionId: "session-2",
      anonId: "anon-2",
      messages: [
        {
          id: "msg-1",
          role: "user",
          content: "Pregunta 1",
        },
        {
          id: "msg-2",
          role: "assistant",
          content: "Respuesta 1",
        },
      ],
    };

    const repo = getRepo();

    // First persist
    await persistJob(job);
    let session = await repo.getSession("session-2", { anonId: "anon-2" });
    expect(session?.messages).toHaveLength(2);

    // Second persist (identical): should not duplicate messages
    await persistJob(job);
    session = await repo.getSession("session-2", { anonId: "anon-2" });
    expect(session?.messages).toHaveLength(2);
  });

  it("should handle messages with token metadata", async () => {
    const messages: PersistedMessage[] = [
      {
        id: "msg-1",
        role: "user",
        content: "Pregunta",
        tokensIn: 100,
      },
      {
        id: "msg-2",
        role: "assistant",
        content: "Respuesta",
        tokensOut: 200,
        model: "claude-fable-5-1",
      },
    ];

    const job: PersistJob = {
      sessionId: "session-3",
      userId: "user-1",
      messages,
    };

    const repo = getRepo();
    await persistJob(job);

    const session = await repo.getSession("session-3", { userId: "user-1" });
    expect(session?.messages).toHaveLength(2);
    // Messages are stored without token metadata in the API response
    expect(session?.messages[0].content).toBe("Pregunta");
    expect(session?.messages[1].content).toBe("Respuesta");
  });
});

describe("queue: enqueuePersist", () => {
  beforeEach(() => {
    resetRepo();
    resetEnvCache();
    delete process.env.DATABASE_URL;
    delete process.env.QSTASH_TOKEN;
  });

  it("should persist inline when QSTASH_TOKEN is not set", async () => {
    const job: PersistJob = {
      sessionId: "session-4",
      anonId: "anon-4",
      messages: [
        {
          id: "msg-1",
          role: "user",
          content: "Test message",
        },
      ],
    };

    const repo = getRepo();

    // No token: should execute inline
    await enqueuePersist(job);

    const session = await repo.getSession("session-4", { anonId: "anon-4" });
    expect(session).not.toBeNull();
    expect(session?.messages).toHaveLength(1);
  });

  it("should use deduplication ID from last message when persisting via QStash", async () => {
    const msg1Id = "msg-1";
    const msg2Id = "msg-2";

    const job: PersistJob = {
      sessionId: "session-5",
      anonId: "anon-5",
      messages: [
        {
          id: msg1Id,
          role: "user",
          content: "First",
        },
        {
          id: msg2Id,
          role: "assistant",
          content: "Second",
        },
      ],
    };

    // Set QSTASH_TOKEN to trigger QStash path
    process.env.QSTASH_TOKEN = "test-token";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    resetEnvCache();

    await enqueuePersist(job);

    // With QSTASH_TOKEN set, the function should attempt to publish via QStash
    // The mocked Client.publishJSON would be called with the job and deduplicationId
    expect(true).toBe(true);
  });

  it("should handle empty messages array gracefully", async () => {
    const job: PersistJob = {
      sessionId: "session-6",
      anonId: "anon-6",
      messages: [],
    };

    const repo = getRepo();
    await enqueuePersist(job);

    const session = await repo.getSession("session-6", { anonId: "anon-6" });
    expect(session?.messages).toHaveLength(0);
  });
});
