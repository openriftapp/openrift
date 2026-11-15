import type { Insertable, Kysely, Selectable, SqlBool } from "kysely";
import { sql } from "kysely";

import type { Database } from "../../../db/tables.js";
import type {
  PlayloltcgDecklistCardsTable,
  PlayloltcgDecklistsTable,
  PlayloltcgEventStandingsTable,
} from "../../../db/tables/meta-sources.js";
import type { MirrorDeckCoverage } from "./mirror-results.js";
import {
  deckCoverageOf,
  putMirrorDecklist,
  replaceRows,
  replaceUnderEventLock,
} from "./mirror-results.js";

export type PlayloltcgStandingRow = Selectable<PlayloltcgEventStandingsTable>;
export type PlayloltcgDecklistCardRow = Selectable<PlayloltcgDecklistCardsTable>;

const NO_CARDS = sql<SqlBool>`not exists (
  select 1 from playloltcg_decklist_cards c where c.source_deck_id = dl.source_deck_id
)`;

export function playloltcgResultsRepo(db: Kysely<Database>) {
  /** Deck ids already held, fetched or refused, so a pass never re-requests one as missing. */
  async function heldDeckIds(activityShopId: number): Promise<Set<string>> {
    const held = await db
      .selectFrom("playloltcgDecklists")
      .select("sourceDeckId")
      .where("activityShopId", "=", activityShopId)
      .execute();
    return new Set(held.map((row) => row.sourceDeckId));
  }

  return {
    standings(activityShopId: number): Promise<PlayloltcgStandingRow[]> {
      return db
        .selectFrom("playloltcgEventStandings")
        .selectAll()
        .where("activityShopId", "=", activityShopId)
        .orderBy("rank", "asc")
        .orderBy("playerKey", "asc")
        .execute();
    },

    /** Wholesale, because the source re-ranks provisional standings into final ones. */
    async replaceStandings(
      activityShopId: number,
      rows: readonly Insertable<PlayloltcgEventStandingsTable>[],
    ): Promise<void> {
      await replaceUnderEventLock(
        db,
        "playloltcg",
        activityShopId,
        replaceRows(
          (trx) =>
            trx
              .deleteFrom("playloltcgEventStandings")
              .where("activityShopId", "=", activityShopId)
              .execute(),
          rows,
          (trx, batch) => trx.insertInto("playloltcgEventStandings").values(batch).execute(),
        ),
      );
    },

    async deckCoverage(activityShopId: number): Promise<MirrorDeckCoverage> {
      const referenced = await db
        .selectFrom("playloltcgEventStandings")
        .select("sourceDeckId")
        .distinct()
        .where("activityShopId", "=", activityShopId)
        .where("sourceDeckId", "is not", null)
        .execute();
      return deckCoverageOf(
        referenced.map((row) => row.sourceDeckId),
        await heldDeckIds(activityShopId),
      );
    },

    heldDeckIds,

    async emptyDeckIds(activityShopId: number, askedBefore: Date): Promise<string[]> {
      const rows = await db
        .selectFrom("playloltcgDecklists as dl")
        .select("dl.sourceDeckId")
        .where("dl.activityShopId", "=", activityShopId)
        .where("dl.fetchStatus", "=", "fetched")
        .where(NO_CARDS)
        .where(sql<SqlBool>`date_trunc('milliseconds', dl.fetched_at) < ${askedBefore}`)
        .orderBy("dl.sourceDeckId", "asc")
        .execute();
      return rows.map((row) => row.sourceDeckId);
    },

    async markDecksAsked(
      activityShopId: number,
      sourceDeckIds: readonly string[],
      at: Date,
    ): Promise<void> {
      if (sourceDeckIds.length === 0) {
        return;
      }
      await db
        .updateTable("playloltcgDecklists")
        .set({ fetchedAt: at })
        .where("activityShopId", "=", activityShopId)
        .where("sourceDeckId", "in", sourceDeckIds)
        .execute();
    },

    async finalizeEmptyDecks(activityShopId: number): Promise<void> {
      await db
        .updateTable("playloltcgDecklists as dl")
        .set({ fetchStatus: "refused" })
        .where("dl.activityShopId", "=", activityShopId)
        .where("dl.fetchStatus", "=", "fetched")
        .where(NO_CARDS)
        .execute();
    },

    async decklistCards(activityShopId: number): Promise<Map<string, PlayloltcgDecklistCardRow[]>> {
      const rows = await db
        .selectFrom("playloltcgDecklistCards")
        .innerJoin(
          "playloltcgDecklists",
          "playloltcgDecklists.sourceDeckId",
          "playloltcgDecklistCards.sourceDeckId",
        )
        .selectAll("playloltcgDecklistCards")
        .where("playloltcgDecklists.activityShopId", "=", activityShopId)
        .orderBy("playloltcgDecklistCards.lineNumber", "asc")
        .execute();
      return Map.groupBy(rows, (row) => row.sourceDeckId);
    },

    async putDecklist(
      row: Insertable<PlayloltcgDecklistsTable>,
      cards: readonly Omit<Insertable<PlayloltcgDecklistCardsTable>, "sourceDeckId">[],
    ): Promise<void> {
      await putMirrorDecklist(
        db,
        (trx) =>
          trx
            .insertInto("playloltcgDecklists")
            .values(row)
            .onConflict((oc) =>
              oc.column("sourceDeckId").doUpdateSet({
                activityShopId: row.activityShopId,
                fetchStatus: row.fetchStatus,
                fetchedAt: row.fetchedAt,
              }),
            )
            .execute(),
        replaceRows(
          (trx) =>
            trx
              .deleteFrom("playloltcgDecklistCards")
              .where("sourceDeckId", "=", row.sourceDeckId)
              .execute(),
          cards.map((card) => ({ ...card, sourceDeckId: row.sourceDeckId })),
          (trx, batch) => trx.insertInto("playloltcgDecklistCards").values(batch).execute(),
        ),
      );
    },
  };
}
