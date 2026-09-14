import type { Kysely } from "kysely";

import type { Database } from "../../../db/tables.js";
import type { CardTradeSettlementRequestsTable } from "../../../db/tables/trades.js";

export function cardTradeSettlementRequestsRepo(db: Kysely<Database>) {
  return {
    findSettlementRequest(tradeId: string, userId: string, requestId: string) {
      return db
        .selectFrom("cardTradeSettlementRequests")
        .select(["fingerprint", "settledTradeId"])
        .where("tradeId", "=", tradeId)
        .where("userId", "=", userId)
        .where("requestId", "=", requestId)
        .executeTakeFirst();
    },
    async recordSettlementRequest(values: CardTradeSettlementRequestsTable): Promise<void> {
      await db.insertInto("cardTradeSettlementRequests").values(values).execute();
    },
  };
}
