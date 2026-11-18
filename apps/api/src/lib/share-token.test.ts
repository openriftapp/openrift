import { describe, expect, it, vi } from "vitest";

import { AppError } from "../errors.js";
import { enableShare, generateShareToken, withUniqueShareToken } from "./share-token.js";

function uniqueViolation(constraintName?: string): Error {
  const error = new Error("duplicate key value violates unique constraint");
  Object.assign(error, { code: "23505", constraint_name: constraintName });
  return error;
}

describe("generateShareToken", () => {
  it("produces 12-char base62 tokens", () => {
    for (let i = 0; i < 20; i++) {
      expect(generateShareToken()).toMatch(/^[A-Za-z0-9]{12}$/u);
    }
  });

  it("produces distinct tokens", () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateShareToken()));
    expect(tokens.size).toBe(100);
  });
});

const TOKEN_CONSTRAINT = "uq_decks_share_token";
const options = { constraint: TOKEN_CONSTRAINT };

describe("withUniqueShareToken", () => {
  it("returns the callback result on first success", async () => {
    const attempt = vi.fn(async (token: string) => `stored:${token}`);
    const result = await withUniqueShareToken(attempt, options);
    expect(result).toMatch(/^stored:[A-Za-z0-9]{12}$/u);
    expect(attempt).toHaveBeenCalledOnce();
  });

  it("retries with a fresh token on a violation of the token constraint", async () => {
    const seen: string[] = [];
    const attempt = vi.fn(async (token: string) => {
      seen.push(token);
      if (seen.length === 1) {
        throw uniqueViolation(TOKEN_CONSTRAINT);
      }
      return token;
    });
    const result = await withUniqueShareToken(attempt, options);
    expect(attempt).toHaveBeenCalledTimes(2);
    expect(result).toBe(seen[1]);
    expect(seen[0]).not.toBe(seen[1]);
  });

  it("gives up after three collisions", async () => {
    const attempt = vi.fn(async () => {
      throw uniqueViolation(TOKEN_CONSTRAINT);
    });
    await expect(withUniqueShareToken(attempt, options)).rejects.toThrow("duplicate key");
    expect(attempt).toHaveBeenCalledTimes(3);
  });

  it("propagates other errors immediately", async () => {
    const attempt = vi.fn(async () => {
      throw new Error("Not found");
    });
    await expect(withUniqueShareToken(attempt, options)).rejects.toThrow("Not found");
    expect(attempt).toHaveBeenCalledOnce();
  });

  it("propagates a violation from another constraint immediately", async () => {
    const attempt = vi.fn(async () => {
      throw uniqueViolation("uq_meta_decks_source");
    });
    await expect(withUniqueShareToken(attempt, options)).rejects.toThrow("duplicate key");
    expect(attempt).toHaveBeenCalledOnce();
  });

  it("propagates a violation that names no constraint immediately", async () => {
    const attempt = vi.fn(async () => {
      throw uniqueViolation();
    });
    await expect(withUniqueShareToken(attempt, options)).rejects.toThrow("duplicate key");
    expect(attempt).toHaveBeenCalledOnce();
  });
});

describe("enableShare", () => {
  it("returns the existing token without writing while the row is shared", async () => {
    const write = vi.fn();
    const result = await enableShare({
      read: async () => ({ shareToken: "existingTok1", isPublic: true }),
      write,
      ...options,
    });
    expect(result).toEqual({ shareToken: "existingTok1", isPublic: true });
    expect(write).not.toHaveBeenCalled();
  });

  it("mints and writes a token for an unshared row", async () => {
    const write = vi.fn(async (token: string) => ({ shareToken: token }));
    const result = await enableShare({
      read: async () => ({ shareToken: null, isPublic: false }),
      write,
      ...options,
    });
    expect(result.isPublic).toBe(true);
    expect(result.shareToken).toMatch(/^[A-Za-z0-9]{12}$/u);
    expect(write).toHaveBeenCalledWith(result.shareToken);
  });

  it("replaces a token left on a revoked row", async () => {
    const write = vi.fn(async (token: string) => ({ shareToken: token }));
    const result = await enableShare({
      read: async () => ({ shareToken: "staleToken12", isPublic: false }),
      write,
      ...options,
    });
    expect(result.shareToken).not.toBe("staleToken12");
    expect(write).toHaveBeenCalledOnce();
  });

  it("returns the token a concurrent enable stored first", async () => {
    const result = await enableShare({
      read: async () => ({ shareToken: null, isPublic: false }),
      write: async () => ({ shareToken: "winnerTok123" }),
      ...options,
    });
    expect(result).toEqual({ shareToken: "winnerTok123", isPublic: true });
  });

  it("throws 404 when the row is not the caller's", async () => {
    const write = vi.fn();
    await expect(
      enableShare({ read: async () => undefined, write, ...options }),
    ).rejects.toBeInstanceOf(AppError);
    expect(write).not.toHaveBeenCalled();
  });

  it("throws 404 when the write finds no row", async () => {
    await expect(
      enableShare({
        read: async () => ({ shareToken: null, isPublic: false }),
        write: async () => undefined,
        ...options,
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("retries the write on a token collision", async () => {
    const write = vi
      .fn()
      .mockRejectedValueOnce(uniqueViolation(TOKEN_CONSTRAINT))
      .mockResolvedValueOnce({});
    const result = await enableShare({
      read: async () => ({ shareToken: null, isPublic: false }),
      write,
      ...options,
    });
    expect(write).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenLastCalledWith(result.shareToken);
  });

  it("does not retry a unique violation on another constraint", async () => {
    const write = vi.fn().mockRejectedValue(uniqueViolation("uq_decks_family_primary"));
    await expect(
      enableShare({
        read: async () => ({ shareToken: null, isPublic: false }),
        write,
        ...options,
      }),
    ).rejects.toThrow("duplicate key");
    expect(write).toHaveBeenCalledOnce();
  });
});
