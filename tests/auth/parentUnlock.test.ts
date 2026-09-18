import { afterEach, describe, expect, it } from "vitest";
import { createUnlockToken, resetParentUnlockMemory, verifyUnlockToken } from "@/lib/auth/parentUnlock";

describe("parentUnlock", () => {
  afterEach(() => resetParentUnlockMemory());

  it("un token creado para un usuario lo desbloquea a él y a nadie más", async () => {
    const token = await createUnlockToken("user-1");
    expect(await verifyUnlockToken(token, "user-1")).toBe(true);
    expect(await verifyUnlockToken(token, "user-2")).toBe(false);
  });

  it("un token inventado o vacío nunca desbloquea", async () => {
    expect(await verifyUnlockToken("token-inventado", "user-1")).toBe(false);
    expect(await verifyUnlockToken(undefined, "user-1")).toBe(false);
  });

  it("tokens de usuarios distintos no se confunden entre sí", async () => {
    const t1 = await createUnlockToken("user-1");
    const t2 = await createUnlockToken("user-2");
    expect(await verifyUnlockToken(t1, "user-1")).toBe(true);
    expect(await verifyUnlockToken(t2, "user-1")).toBe(false);
    expect(await verifyUnlockToken(t1, "user-2")).toBe(false);
    expect(await verifyUnlockToken(t2, "user-2")).toBe(true);
  });
});
