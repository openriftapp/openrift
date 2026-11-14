import type { Insertable, Kysely, Selectable } from "kysely";

import type { Database } from "../../../db/tables.js";
import type {
  UvsgamesDecklistCardsTable,
  UvsgamesDecklistsTable,
  UvsgamesEventMatchesTable,
  UvsgamesEventPhasesTable,
  UvsgamesEventStandingsTable,
} from "../../../db/tables/meta-sources.js";
import type { MirrorDeckCoverage } from "./mirror-results.js";
import {
  deckCoverageOf,
  putMirrorDecklist,
  replaceRows,
  replaceUnderEventLock,
} from "./mirror-results.js";

export type UvsgamesStandingRow = Selectable<UvsgamesEventStandingsTable>;
export type UvsgamesPhaseRow = Selectable<UvsgamesEventPhasesTable>;
export type UvsgamesMatchRow = Selectable<UvsgamesEventMatchesTable>;
export type UvsgamesDecklistCardRow = Selectable<UvsgamesDecklistCardsTable>;

export interface UvsgamesNamedStandingRow {
  registrationId: string;
  uvsgamesPlayerId: number | null;
  playerName: string | null;
  rank: number | null;
  wins: number | null;
  losses: number | null;
  draws: number | null;
  legendName: string | null;
}

export function uvsgamesResultsRepo(db: Kysely<Database>) {
  return {
    standings(externalId: string): Promise<UvsgamesStandingRow[]> {
      return db
        .selectFrom("uvsgamesEventStandings")
        .selectAll()
        .where("externalId", "=", externalId)
        .orderBy("rank", "asc")
        .orderBy("registrationId", "asc")
        .execute();
    },

    namedStandings(externalId: string): Promise<UvsgamesNamedStandingRow[]> {
      return db
        .selectFrom("uvsgamesEventStandings as s")
        .leftJoin("uvsgamesPlayers as up", "up.id", "s.uvsgamesPlayerId")
        .select([
          "s.registrationId",
          "s.uvsgamesPlayerId",
          "s.rank",
          "s.wins",
          "s.losses",
          "s.draws",
          "s.legendName",
        ])
        .select((eb) => eb.fn.coalesce("up.displayName", "s.playerName").as("playerName"))
        .where("s.externalId", "=", externalId)
        .orderBy("s.rank", "asc")
        .orderBy("s.registrationId", "asc")
        .execute();
    },

    // The registration key stays stable across a re-fetch, so nothing
    // downstream loses its identity when provisional ranks are corrected.
    async replaceStandings(
      externalId: string,
      rows: readonly Insertable<UvsgamesEventStandingsTable>[],
    ): Promise<void> {
      await replaceUnderEventLock(
        db,
        "uvsgames",
        externalId,
        replaceRows(
          (trx) =>
            trx.deleteFrom("uvsgamesEventStandings").where("externalId", "=", externalId).execute(),
          rows,
          (trx, batch) => trx.insertInto("uvsgamesEventStandings").values(batch).execute(),
        ),
      );
    },

    phases(externalId: string): Promise<UvsgamesPhaseRow[]> {
      return db
        .selectFrom("uvsgamesEventPhases")
        .selectAll()
        .where("externalId", "=", externalId)
        .orderBy("phaseOrder", "asc")
        .execute();
    },

    async replacePhases(
      externalId: string,
      rows: readonly Insertable<UvsgamesEventPhasesTable>[],
    ): Promise<void> {
      await replaceUnderEventLock(
        db,
        "uvsgames",
        externalId,
        replaceRows(
          (trx) =>
            trx.deleteFrom("uvsgamesEventPhases").where("externalId", "=", externalId).execute(),
          rows,
          (trx, batch) => trx.insertInto("uvsgamesEventPhases").values(batch).execute(),
        ),
      );
    },

    matches(externalId: string): Promise<UvsgamesMatchRow[]> {
      return db
        .selectFrom("uvsgamesEventMatches")
        .selectAll()
        .where("externalId", "=", externalId)
        .orderBy("phaseOrder", "asc")
        .orderBy("roundNumber", "asc")
        .orderBy("tableNumber", "asc")
        .orderBy("sourceMatchId", "asc")
        .execute();
    },

    // A completed round's pairings are immutable; the fetcher skips them.
    async heldRoundIds(externalId: string): Promise<string[]> {
      const rows = await db
        .selectFrom("uvsgamesEventMatches")
        .select("roundId")
        .distinct()
        .where("externalId", "=", externalId)
        .execute();
      return rows.map((row) => row.roundId);
    },

    async replaceRoundMatches(
      externalId: string,
      roundId: string,
      rows: readonly Insertable<UvsgamesEventMatchesTable>[],
    ): Promise<void> {
      await replaceUnderEventLock(
        db,
        "uvsgames",
        externalId,
        replaceRows(
          (trx) =>
            trx
              .deleteFrom("uvsgamesEventMatches")
              .where("externalId", "=", externalId)
              .where("roundId", "=", roundId)
              .execute(),
          rows,
          (trx, batch) => trx.insertInto("uvsgamesEventMatches").values(batch).execute(),
        ),
      );
    },

    // A refused deck counts as held: the id was tried and came back
    // unreadable, and asking again would only spend the budget.
    async deckCoverage(externalId: string): Promise<MirrorDeckCoverage> {
      const referenced = await db
        .selectFrom("uvsgamesEventStandings")
        .select("sourceDeckId")
        .distinct()
        .where("externalId", "=", externalId)
        .where("sourceDeckId", "is not", null)
        .execute();
      const held = await db
        .selectFrom("uvsgamesDecklists")
        .select("sourceDeckId")
        .where("externalId", "=", externalId)
        .execute();
      return deckCoverageOf(
        referenced.map((row) => row.sourceDeckId),
        new Set(held.map((row) => row.sourceDeckId)),
      );
    },

    async decklistCards(externalId: string): Promise<Map<string, UvsgamesDecklistCardRow[]>> {
      const rows = await db
        .selectFrom("uvsgamesDecklistCards")
        .innerJoin(
          "uvsgamesDecklists",
          "uvsgamesDecklists.sourceDeckId",
          "uvsgamesDecklistCards.sourceDeckId",
        )
        .selectAll("uvsgamesDecklistCards")
        .where("uvsgamesDecklists.externalId", "=", externalId)
        .orderBy("uvsgamesDecklistCards.lineNumber", "asc")
        .execute();
      return Map.groupBy(rows, (row) => row.sourceDeckId);
    },

    // Idempotent on the deck id: a second write of the same id replaces, not duplicates.
    async putDecklist(
      row: Insertable<UvsgamesDecklistsTable>,
      cards: readonly Omit<Insertable<UvsgamesDecklistCardsTable>, "sourceDeckId">[],
    ): Promise<void> {
      await putMirrorDecklist(
        db,
        (trx) =>
          trx
            .insertInto("uvsgamesDecklists")
            .values(row)
            .onConflict((oc) =>
              oc.column("sourceDeckId").doUpdateSet({
                externalId: row.externalId,
                fetchStatus: row.fetchStatus,
                fetchedAt: row.fetchedAt,
              }),
            )
            .execute(),
        replaceRows(
          (trx) =>
            trx
              .deleteFrom("uvsgamesDecklistCards")
              .where("sourceDeckId", "=", row.sourceDeckId)
              .execute(),
          cards.map((card) => ({ ...card, sourceDeckId: row.sourceDeckId })),
          (trx, batch) => trx.insertInto("uvsgamesDecklistCards").values(batch).execute(),
        ),
      );
    },
  };
}
