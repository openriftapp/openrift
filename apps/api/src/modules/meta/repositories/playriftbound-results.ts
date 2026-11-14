import type { Insertable, Kysely, Selectable } from "kysely";

import type { Database } from "../../../db/tables.js";
import type {
  PlayriftboundEventMatchesTable,
  PlayriftboundEventPhasesTable,
  PlayriftboundEventStandingsTable,
} from "../../../db/tables/meta-sources.js";
import { replaceRows, replaceUnderEventLock } from "./mirror-results.js";

export type PlayriftboundStandingRow = Selectable<PlayriftboundEventStandingsTable>;
export type PlayriftboundPhaseRow = Selectable<PlayriftboundEventPhasesTable>;
export type PlayriftboundMatchRow = Selectable<PlayriftboundEventMatchesTable>;

export interface PlayriftboundResults {
  standings: readonly Insertable<PlayriftboundEventStandingsTable>[];
  phases: readonly Insertable<PlayriftboundEventPhasesTable>[];
  matches: readonly Insertable<PlayriftboundEventMatchesTable>[];
}

export function playriftboundResultsRepo(db: Kysely<Database>) {
  return {
    standings(tournamentId: string): Promise<PlayriftboundStandingRow[]> {
      return db
        .selectFrom("playriftboundEventStandings")
        .selectAll()
        .where("tournamentId", "=", tournamentId)
        .orderBy("rank", "asc")
        .orderBy("teamId", "asc")
        .execute();
    },

    phases(tournamentId: string): Promise<PlayriftboundPhaseRow[]> {
      return db
        .selectFrom("playriftboundEventPhases")
        .selectAll()
        .where("tournamentId", "=", tournamentId)
        .orderBy("phaseOrder", "asc")
        .execute();
    },

    matches(tournamentId: string): Promise<PlayriftboundMatchRow[]> {
      return db
        .selectFrom("playriftboundEventMatches")
        .selectAll()
        .where("tournamentId", "=", tournamentId)
        .orderBy("phaseOrder", "asc")
        .orderBy("roundNumber", "asc")
        .orderBy("tableNumber", "asc")
        .orderBy("sourceMatchId", "asc")
        .execute();
    },

    /** Wholesale: one detail response is the whole event, and standings re-rank every round. */
    async replaceResults(tournamentId: string, results: PlayriftboundResults): Promise<void> {
      await replaceUnderEventLock(
        db,
        "playriftbound",
        tournamentId,
        replaceRows(
          (trx) =>
            trx
              .deleteFrom("playriftboundEventStandings")
              .where("tournamentId", "=", tournamentId)
              .execute(),
          results.standings,
          (trx, batch) => trx.insertInto("playriftboundEventStandings").values(batch).execute(),
        ),
        replaceRows(
          (trx) =>
            trx
              .deleteFrom("playriftboundEventPhases")
              .where("tournamentId", "=", tournamentId)
              .execute(),
          results.phases,
          (trx, batch) => trx.insertInto("playriftboundEventPhases").values(batch).execute(),
        ),
        replaceRows(
          (trx) =>
            trx
              .deleteFrom("playriftboundEventMatches")
              .where("tournamentId", "=", tournamentId)
              .execute(),
          results.matches,
          (trx, batch) => trx.insertInto("playriftboundEventMatches").values(batch).execute(),
        ),
      );
    },
  };
}
