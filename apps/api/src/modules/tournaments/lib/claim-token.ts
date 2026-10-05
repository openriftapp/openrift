import { isUniqueViolationOn } from "../../../lib/pg-errors.js";
import { withUniqueShareToken } from "../../../lib/share-token.js";

const CLAIM_TOKEN_CONSTRAINT = "uq_tournament_participants_claim_token";
const MAX_TRANSACTION_ATTEMPTS = 3;

/** Postgres aborts a transaction on 23505, so never call this inside one: the retry could not recover. */
export function withUniqueClaimToken<Result>(
  attempt: (claimToken: string) => Promise<Result>,
): Promise<Result> {
  return withUniqueShareToken(attempt, { constraint: CLAIM_TOKEN_CONSTRAINT });
}

/**
 * Wraps a whole transaction that mints claim tokens inside it. A collision
 * aborts the transaction, so each retry reruns it and mints fresh tokens.
 */
export async function retryOnClaimTokenCollision<Result>(
  runTransaction: () => Promise<Result>,
): Promise<Result> {
  for (let tries = 1; ; tries++) {
    try {
      return await runTransaction();
    } catch (error) {
      if (
        tries >= MAX_TRANSACTION_ATTEMPTS ||
        !isUniqueViolationOn(error, CLAIM_TOKEN_CONSTRAINT)
      ) {
        throw error;
      }
    }
  }
}
