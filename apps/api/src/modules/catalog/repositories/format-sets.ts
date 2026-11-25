import type { ExpressionBuilder, Kysely } from "kysely";

import type { Database } from "../../../db/tables.js";

interface FormatSetKey {
  formatId: string;
  setId: string;
  circuit: string | null;
}

function matchesKey(key: FormatSetKey) {
  return (eb: ExpressionBuilder<Database, "formatSets">) =>
    eb.and([
      eb("formatSets.formatId", "=", key.formatId),
      eb("formatSets.setId", "=", key.setId),
      key.circuit === null
        ? eb("formatSets.circuit", "is", null)
        : eb("formatSets.circuit", "=", key.circuit),
    ]);
}

export function formatSetsRepo(db: Kysely<Database>) {
  function selectWindows() {
    return db
      .selectFrom("formatSets")
      .innerJoin("sets", "sets.id", "formatSets.setId")
      .select([
        "formatSets.id",
        "formatSets.formatId",
        "formatSets.setId",
        "sets.slug as setSlug",
        "formatSets.circuit",
        "formatSets.legalFrom",
        "formatSets.legalUntil",
      ]);
  }

  return {
    listAll() {
      return selectWindows()
        .orderBy("formatSets.formatId")
        .orderBy("sets.sortOrder")
        .orderBy("formatSets.circuit", (ob) => ob.nullsFirst())
        .execute();
    },

    async upsert(window: FormatSetKey & { legalFrom: string | null; legalUntil: string | null }) {
      await db
        .insertInto("formatSets")
        .values(window)
        .onConflict((oc) =>
          oc
            .columns(["formatId", "setId", "circuit"])
            .doUpdateSet({ legalFrom: window.legalFrom, legalUntil: window.legalUntil }),
        )
        .execute();
      return selectWindows().where(matchesKey(window)).executeTakeFirstOrThrow();
    },

    async remove(key: FormatSetKey): Promise<boolean> {
      const result = await db.deleteFrom("formatSets").where(matchesKey(key)).executeTakeFirst();
      return Number(result.numDeletedRows) > 0;
    },
  };
}
