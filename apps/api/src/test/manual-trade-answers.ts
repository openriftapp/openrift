import type { Kysely } from "kysely";

import type { Database } from "../db/tables.js";
import { createTrade } from "../modules/groups/services/card-trades.js";

export function createTradeAnsweredByHand(db: () => Kysely<Database>): typeof createTrade {
  return async (deps, input, emailDeps) => {
    await db()
      .updateTable("friendGroupMembers")
      .set({ isAutoAcceptingOffers: false, isAutoAcceptingRequests: false })
      .where("userId", "=", input.counterpartyUserId)
      .execute();
    return createTrade(deps, input, emailDeps);
  };
}
