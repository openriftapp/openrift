import { todayUtc } from "@openrift/shared/format-date";
import type { ExpressionBuilder, Kysely } from "kysely";
import { sql } from "kysely";

import type { Database } from "../../../db/tables.js";

function sameCircuit(circuit: string | null) {
  return (eb: ExpressionBuilder<Database, "cardBans">) =>
    circuit === null ? eb("cardBans.circuit", "is", null) : eb("cardBans.circuit", "=", circuit);
}

export function cardBansRepo(db: Kysely<Database>) {
  async function withFormatName<T extends { formatId: string }>(row: T) {
    const format = await db
      .selectFrom("banFormats")
      .select("label")
      .where("slug", "=", row.formatId)
      .executeTakeFirstOrThrow();
    return { ...row, formatName: format.label };
  }

  return {
    listFormats() {
      return db
        .selectFrom("banFormats")
        .select(["slug as id", "label as name"])
        .orderBy("sortOrder")
        .execute();
    },

    listCircuits() {
      return db
        .selectFrom("circuits")
        .select(["slug", "label", "countryCodes"])
        .orderBy("sortOrder")
        .execute();
    },

    /** Circuits whose ban list moves only at their own set releases. */
    async setBanListCircuits(): Promise<string[]> {
      const rows = await db
        .selectFrom("circuits")
        .select("slug")
        .where("hasSetBanLists", "=", true)
        .orderBy("sortOrder")
        .execute();
      return rows.map((row) => row.slug);
    },

    listByCard(cardId: string) {
      return db
        .selectFrom("cardBans")
        .innerJoin("banFormats", "banFormats.slug", "cardBans.formatId")
        .leftJoin("circuits", "circuits.slug", "cardBans.circuit")
        .selectAll("cardBans")
        .select("banFormats.label as formatName")
        .where("cardBans.cardId", "=", cardId)
        .where("cardBans.unbannedAt", "is", null)
        .orderBy("banFormats.sortOrder")
        .orderBy("circuits.sortOrder", (ob) => ob.nullsFirst())
        .execute();
    },

    /**
     * Raw rows for `banFormatsInEffect`: the global rows and, with a circuit,
     * that circuit's rows, lifted ones included.
     */
    listForCards(cardIds: string[], formatIds: string[], circuit?: string) {
      if (cardIds.length === 0 || formatIds.length === 0) {
        return Promise.resolve([]);
      }
      return db
        .selectFrom("cardBans")
        .select(["cardId", "formatId", "circuit", "bannedAt", "unbannedAt"])
        .where("cardId", "in", cardIds)
        .where("formatId", "in", formatIds)
        .where((eb) =>
          circuit === undefined
            ? eb("circuit", "is", null)
            : eb.or([eb("circuit", "is", null), eb("circuit", "=", circuit)]),
        )
        .execute();
    },

    getActiveBan(cardId: string, formatId: string, circuit: string | null) {
      return db
        .selectFrom("cardBans")
        .selectAll()
        .where("cardId", "=", cardId)
        .where("formatId", "=", formatId)
        .where(sameCircuit(circuit))
        .where("unbannedAt", "is", null)
        .executeTakeFirst();
    },

    /**
     * A circuit's rows replace the global ones on every date, so its first row
     * also copies the global history up to today as lifted circuit rows.
     */
    async create(ban: {
      cardId: string;
      formatId: string;
      circuit: string | null;
      bannedAt: string | null;
      reason: string | null;
    }) {
      const row = await db.transaction().execute(async (trx) => {
        const { circuit } = ban;
        if (circuit !== null) {
          const existing = await trx
            .selectFrom("cardBans")
            .select("id")
            .where("cardId", "=", ban.cardId)
            .where("formatId", "=", ban.formatId)
            .where("circuit", "=", circuit)
            .executeTakeFirst();
          if (!existing) {
            const today = todayUtc();
            await trx
              .insertInto("cardBans")
              .columns(["cardId", "formatId", "circuit", "bannedAt", "unbannedAt", "reason"])
              .expression((eb) =>
                eb
                  .selectFrom("cardBans")
                  .select([
                    "cardId",
                    "formatId",
                    sql<string>`${circuit}::text`.as("circuit"),
                    "bannedAt",
                    sql<string>`least(coalesce(unbanned_at, ${today}::date), ${today}::date)`.as(
                      "unbannedAt",
                    ),
                    "reason",
                  ])
                  .where("cardId", "=", ban.cardId)
                  .where("formatId", "=", ban.formatId)
                  .where("circuit", "is", null)
                  .where("bannedAt", "<", today),
              )
              .execute();
          }
        }
        return trx.insertInto("cardBans").values(ban).returningAll().executeTakeFirstOrThrow();
      });
      return withFormatName(row);
    },

    async update(
      cardId: string,
      formatId: string,
      circuit: string | null,
      fields: { bannedAt?: string | null; reason?: string | null },
    ) {
      const row = await db
        .updateTable("cardBans")
        .set(fields)
        .where("cardId", "=", cardId)
        .where("formatId", "=", formatId)
        .where(sameCircuit(circuit))
        .where("unbannedAt", "is", null)
        .returningAll()
        .executeTakeFirst();
      return row ? withFormatName(row) : null;
    },

    /** A ban that never took effect (undated, or starting after today) is deleted, not lifted. */
    async unban(
      cardId: string,
      formatId: string,
      circuit: string | null,
    ): Promise<"deleted" | "lifted" | null> {
      const deleted = await db
        .deleteFrom("cardBans")
        .where("cardId", "=", cardId)
        .where("formatId", "=", formatId)
        .where(sameCircuit(circuit))
        .where("unbannedAt", "is", null)
        .where((eb) => eb.or([eb("bannedAt", "is", null), eb("bannedAt", ">", todayUtc())]))
        .executeTakeFirst();
      if (Number(deleted.numDeletedRows) > 0) {
        return "deleted";
      }
      const result = await db
        .updateTable("cardBans")
        .set({ unbannedAt: todayUtc() })
        .where("cardId", "=", cardId)
        .where("formatId", "=", formatId)
        .where(sameCircuit(circuit))
        .where("unbannedAt", "is", null)
        .executeTakeFirst();
      return Number(result.numUpdatedRows) > 0 ? "lifted" : null;
    },

    async deleteUndatedCircuitRows(cardId: string, formatId: string): Promise<void> {
      await db
        .deleteFrom("cardBans")
        .where("cardId", "=", cardId)
        .where("formatId", "=", formatId)
        .where("circuit", "is not", null)
        .where("bannedAt", "is", null)
        .execute();
    },
  };
}
