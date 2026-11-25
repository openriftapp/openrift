import type { DeleteResult, Kysely, Selectable } from "kysely";
import { sql } from "kysely";

import type { Database } from "../../../db/tables.js";
import type {
  IgnoredCandidateCardsTable,
  IgnoredCandidatePrintingsTable,
} from "../../../db/tables/candidates.js";

export function ignoredCandidatesRepo(db: Kysely<Database>) {
  return {
    listIgnoredCards(): Promise<Selectable<IgnoredCandidateCardsTable>[]> {
      return db
        .selectFrom("ignoredCandidateCards")
        .selectAll()
        .orderBy("createdAt", "desc")
        .execute();
    },

    async ignoreCards(sources: readonly { provider: string; externalId: string }[]): Promise<void> {
      if (sources.length === 0) {
        return;
      }
      await db
        .insertInto("ignoredCandidateCards")
        .values(sources.map(({ provider, externalId }) => ({ provider, externalId })))
        .onConflict((oc) => oc.columns(["provider", "externalId"]).doNothing())
        .execute();
    },

    async unignoreCards(
      sources: readonly { provider: string; externalId: string }[],
    ): Promise<void> {
      if (sources.length === 0) {
        return;
      }
      await db
        .deleteFrom("ignoredCandidateCards")
        .where((eb) =>
          eb.or(
            sources.map(({ provider, externalId }) =>
              eb.and([eb("provider", "=", provider), eb("externalId", "=", externalId)]),
            ),
          ),
        )
        .execute();
    },

    listIgnoredPrintings(): Promise<Selectable<IgnoredCandidatePrintingsTable>[]> {
      return db
        .selectFrom("ignoredCandidatePrintings")
        .selectAll()
        .orderBy("createdAt", "desc")
        .execute();
    },

    async ignorePrinting(values: {
      provider: string;
      externalId: string;
      finish: string | null;
    }): Promise<void> {
      await db
        .insertInto("ignoredCandidatePrintings")
        .values(values)
        .onConflict((oc) =>
          oc.expression(sql`provider, external_id, COALESCE(finish, '')`).doNothing(),
        )
        .execute();
    },

    unignorePrinting(
      provider: string,
      externalId: string,
      finish: string | null,
    ): Promise<DeleteResult> {
      return db
        .deleteFrom("ignoredCandidatePrintings")
        .where("provider", "=", provider)
        .where("externalId", "=", externalId)
        .where(
          finish === null ? (eb) => eb("finish", "is", null) : (eb) => eb("finish", "=", finish),
        )
        .executeTakeFirst();
    },
  };
}
