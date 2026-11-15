import type { Kysely, Selectable } from "kysely";

import type { Database } from "../../../db/tables.js";
import type {
  TournamentParticipantsTable,
  TournamentsTable,
} from "../../../db/tables/tournaments.js";
import { lockKey } from "../../../repositories/query-helpers.js";

export type Tournament = Selectable<TournamentsTable>;
export type TournamentParticipant = Selectable<TournamentParticipantsTable>;

/** Call inside a transaction. The round writers and the group-stage writers share this key. */
export async function lockTournamentWrites(
  db: Kysely<Database>,
  tournamentId: string,
): Promise<void> {
  await lockKey(db, `tournament-writes:${tournamentId}`);
}
