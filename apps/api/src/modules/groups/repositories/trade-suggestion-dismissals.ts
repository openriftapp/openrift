import type { TradeSuggestionDismissal } from "@openrift/shared/types/api/card-trade";
import type { Kysely } from "kysely";

import type { Database } from "../../../db/tables.js";

export function tradeSuggestionDismissalsRepo(db: Kysely<Database>) {
  return {
    listForUser(userId: string): Promise<TradeSuggestionDismissal[]> {
      return db
        .selectFrom("tradeSuggestionDismissals")
        .select(["counterpartyUserId", "printingId", "direction"])
        .where("userId", "=", userId)
        .orderBy("createdAt")
        .execute();
    },

    async add(userId: string, dismissal: TradeSuggestionDismissal): Promise<void> {
      await db
        .insertInto("tradeSuggestionDismissals")
        .values({ userId, ...dismissal })
        .onConflict((oc) =>
          oc.columns(["userId", "counterpartyUserId", "printingId", "direction"]).doNothing(),
        )
        .execute();
    },

    async remove(userId: string, dismissal: TradeSuggestionDismissal): Promise<void> {
      await db
        .deleteFrom("tradeSuggestionDismissals")
        .where("userId", "=", userId)
        .where("counterpartyUserId", "=", dismissal.counterpartyUserId)
        .where("printingId", "=", dismissal.printingId)
        .where("direction", "=", dismissal.direction)
        .execute();
    },
  };
}
