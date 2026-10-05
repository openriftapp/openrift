import { assertFound } from "./assertions.js";
import { isUniqueViolation, isUniqueViolationOn } from "./pg-errors.js";

const SHARE_TOKEN_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const SHARE_TOKEN_LENGTH = 12;

/** Rejection-samples bytes below the largest multiple of 62 that fits in a byte, to keep the base62 mapping unbiased. */
export function generateShareToken(): string {
  const threshold = Math.floor(256 / SHARE_TOKEN_ALPHABET.length) * SHARE_TOKEN_ALPHABET.length;
  const out: string[] = [];
  const buf = new Uint8Array(SHARE_TOKEN_LENGTH * 2);
  while (out.length < SHARE_TOKEN_LENGTH) {
    crypto.getRandomValues(buf);
    for (const byte of buf) {
      if (byte < threshold) {
        out.push(SHARE_TOKEN_ALPHABET.charAt(byte % SHARE_TOKEN_ALPHABET.length));
        if (out.length === SHARE_TOKEN_LENGTH) {
          break;
        }
      }
    }
  }
  return out.join("");
}

/**
 * Pass `constraint` when the callback writes more than the token-bearing row:
 * without it, a unique violation on any other row also burns retries as if it were a token collision.
 */
export async function withUniqueShareToken<Result>(
  attempt: (token: string) => Promise<Result>,
  options?: { constraint?: string },
): Promise<Result> {
  const MAX_ATTEMPTS = 3;
  const constraint = options?.constraint;
  for (let tries = 1; ; tries++) {
    try {
      return await attempt(generateShareToken());
    } catch (error) {
      const collided =
        constraint === undefined
          ? isUniqueViolation(error)
          : isUniqueViolationOn(error, constraint);
      if (tries >= MAX_ATTEMPTS || !collided) {
        throw error;
      }
    }
  }
}

export interface ShareStateView {
  shareToken: string | null;
  isPublic: boolean;
}

/**
 * A token left on a revoked row is replaced, so a link from before the revoke stays dead.
 * `read` and `write` resolve undefined for a row the caller does not own (404).
 */
export async function enableShare(handlers: {
  read: () => Promise<ShareStateView | undefined>;
  write: (token: string) => Promise<unknown>;
}): Promise<{ shareToken: string; isPublic: true }> {
  const existing = await handlers.read();
  assertFound(existing, "Not found");
  if (existing.shareToken !== null && existing.isPublic) {
    return { shareToken: existing.shareToken, isPublic: true };
  }
  const shareToken = await withUniqueShareToken(async (candidate) => {
    const updated = await handlers.write(candidate);
    assertFound(updated, "Not found");
    return candidate;
  });
  return { shareToken, isPublic: true };
}
