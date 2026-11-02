import type { Kysely } from "kysely";

import type { Database } from "../../../db/tables.js";
import { lockKey } from "../../../repositories/query-helpers.js";

/**
 * Locks every deck of the given families in id order (`FOR UPDATE`) before a
 * family repair. Lock in id order or concurrent repairs can deadlock.
 */
export async function lockFamilies(
  trx: Kysely<Database>,
  userId: string,
  familyIds: string[],
): Promise<void> {
  if (familyIds.length === 0) {
    return;
  }
  await trx
    .selectFrom("decks")
    .select("id")
    .where("familyId", "in", familyIds)
    .where("userId", "=", userId)
    .orderBy("id")
    .forUpdate()
    .execute();
}

/** Serializes one user's family changes; take it before any deck row lock. */
export async function lockUserFamilies(trx: Kysely<Database>, userId: string): Promise<void> {
  await lockKey(trx, `deck-families:${userId}`);
}
