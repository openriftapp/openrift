import { todayUtc } from "@openrift/shared/format-date";
import type { Kysely } from "kysely";

import type { Database } from "../../../db/tables.js";

export function cardBansRepo(db: Kysely<Database>) {
  return {
    listFormats() {
      return db
        .selectFrom("banFormats")
        .select(["slug as id", "label as name"])
        .orderBy("sortOrder")
        .execute();
    },

    listByCard(cardId: string) {
      return db
        .selectFrom("cardBans")
        .innerJoin("banFormats", "banFormats.slug", "cardBans.formatId")
        .selectAll("cardBans")
        .select("banFormats.label as formatName")
        .where("cardBans.cardId", "=", cardId)
        .where("cardBans.unbannedAt", "is", null)
        .execute();
    },

    listActiveForCards(cardIds: string[], formatIds: string[]) {
      if (cardIds.length === 0 || formatIds.length === 0) {
        return Promise.resolve([]);
      }
      return db
        .selectFrom("cardBans")
        .select(["cardId", "formatId", "bannedAt"])
        .where("cardId", "in", cardIds)
        .where("formatId", "in", formatIds)
        .where("unbannedAt", "is", null)
        .execute();
    },

    getActiveBan(cardId: string, formatId: string) {
      return db
        .selectFrom("cardBans")
        .selectAll()
        .where("cardId", "=", cardId)
        .where("formatId", "=", formatId)
        .where("unbannedAt", "is", null)
        .executeTakeFirst();
    },

    async create(ban: {
      cardId: string;
      formatId: string;
      bannedAt: string;
      reason: string | null;
    }) {
      const row = await db
        .insertInto("cardBans")
        .values(ban)
        .returningAll()
        .executeTakeFirstOrThrow();
      const format = await db
        .selectFrom("banFormats")
        .select("label")
        .where("slug", "=", row.formatId)
        .executeTakeFirstOrThrow();
      return { ...row, formatName: format.label };
    },

    async update(
      cardId: string,
      formatId: string,
      fields: { bannedAt?: string; reason?: string | null },
    ) {
      const row = await db
        .updateTable("cardBans")
        .set(fields)
        .where("cardId", "=", cardId)
        .where("formatId", "=", formatId)
        .where("unbannedAt", "is", null)
        .returningAll()
        .executeTakeFirst();
      if (!row) {
        return null;
      }
      const format = await db
        .selectFrom("banFormats")
        .select("label")
        .where("slug", "=", row.formatId)
        .executeTakeFirstOrThrow();
      return { ...row, formatName: format.label };
    },

    async unban(cardId: string, formatId: string): Promise<boolean> {
      const result = await db
        .updateTable("cardBans")
        .set({ unbannedAt: todayUtc() })
        .where("cardId", "=", cardId)
        .where("formatId", "=", formatId)
        .where("unbannedAt", "is", null)
        .executeTakeFirst();
      return Number(result.numUpdatedRows) > 0;
    },
  };
}
