import type { Repos } from "../../../deps.js";
import type { DeckCheckEntry } from "../repositories/deck-check-entries.js";

export async function syncDeckCheckLegend(
  repos: Repos,
  entry: Pick<DeckCheckEntry, "tournamentId" | "participantId">,
): Promise<void> {
  if (entry.participantId === null) {
    return;
  }
  await repos.tournamentGroups.syncParticipantLegendsFromDeckCheck(entry.tournamentId, [
    entry.participantId,
  ]);
}
