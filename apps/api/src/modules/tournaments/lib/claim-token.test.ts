import { describe, expect, it, vi } from "vitest";

import { retryOnClaimTokenCollision, withUniqueClaimToken } from "./claim-token.js";

function uniqueViolation(constraintName: string): Error {
  return Object.assign(new Error("duplicate key value violates unique constraint"), {
    code: "23505",
    constraint_name: constraintName,
  });
}

describe("withUniqueClaimToken", () => {
  it("passes a fresh token to the write", async () => {
    const result = await withUniqueClaimToken(async (token) => `stored:${token}`);
    expect(result).toMatch(/^stored:[A-Za-z0-9]{12}$/u);
  });

  it("retries with a new token when the claim token collides", async () => {
    const seen: string[] = [];
    const attempt = vi.fn(async (token: string) => {
      seen.push(token);
      if (seen.length === 1) {
        throw uniqueViolation("uq_tournament_participants_claim_token");
      }
      return token;
    });
    const result = await withUniqueClaimToken(attempt);
    expect(attempt).toHaveBeenCalledTimes(2);
    expect(result).toBe(seen[1]);
    expect(seen[0]).not.toBe(seen[1]);
  });

  it("does not retry a unique violation on another constraint", async () => {
    const error = uniqueViolation("uq_tournament_participants_user");
    const attempt = vi.fn(async () => {
      throw error;
    });
    await expect(withUniqueClaimToken(attempt)).rejects.toBe(error);
    expect(attempt).toHaveBeenCalledOnce();
  });
});

describe("retryOnClaimTokenCollision", () => {
  it("returns the transaction result without retrying when nothing collides", async () => {
    const transact = vi.fn(async () => "ok");
    await expect(retryOnClaimTokenCollision(transact)).resolves.toBe("ok");
    expect(transact).toHaveBeenCalledOnce();
  });

  it("reruns the whole transaction after a claim-token collision", async () => {
    const transact = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(uniqueViolation("uq_tournament_participants_claim_token"))
      .mockResolvedValueOnce("ok");
    await expect(retryOnClaimTokenCollision(transact)).resolves.toBe("ok");
    expect(transact).toHaveBeenCalledTimes(2);
  });

  it("gives up after three colliding attempts", async () => {
    const error = uniqueViolation("uq_tournament_participants_claim_token");
    const transact = vi.fn(async () => {
      throw error;
    });
    await expect(retryOnClaimTokenCollision(transact)).rejects.toBe(error);
    expect(transact).toHaveBeenCalledTimes(3);
  });

  it("does not retry a unique violation on another constraint", async () => {
    const error = uniqueViolation("uq_tournament_participants_user");
    const transact = vi.fn(async () => {
      throw error;
    });
    await expect(retryOnClaimTokenCollision(transact)).rejects.toBe(error);
    expect(transact).toHaveBeenCalledOnce();
  });
});
