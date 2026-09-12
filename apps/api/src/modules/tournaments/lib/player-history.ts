import type { PodStandingRow } from "@openrift/shared/types/api/pod-tournament";

import type { PodScoring } from "../repositories/pod-tournaments-shared.js";
import type { Tournament } from "../repositories/tournaments-shared.js";
import { scoringOf } from "./pod-scoring.js";

interface BestFinish {
  rank: number;
  players: number;
}

export interface TournamentHistory {
  played: number;
  bestFinish: BestFinish | null;
}

interface HistoryRepos {
  userProfile: {
    completedTournamentParticipations: (
      userId: string,
    ) => Promise<{ tournament: Tournament; participantId: string }[]>;
  };
  podTournaments: {
    computeStandings: (tournamentId: string, scoring: PodScoring) => Promise<PodStandingRow[]>;
  };
}

/** Standings are ordered, so a player's rank is their row position. */
export async function tournamentHistoryForUser(
  repos: HistoryRepos,
  userId: string,
): Promise<TournamentHistory> {
  const participations = await repos.userProfile.completedTournamentParticipations(userId);
  const finishes = await Promise.all(
    participations.map(async ({ tournament, participantId }) => {
      const standings = await repos.podTournaments.computeStandings(
        tournament.id,
        scoringOf(tournament),
      );
      const index = standings.findIndex((row) => row.playerId === participantId);
      return index === -1 ? null : { rank: index + 1, players: standings.length };
    }),
  );
  let bestFinish: BestFinish | null = null;
  for (const finish of finishes) {
    if (finish === null) {
      continue;
    }
    if (
      bestFinish === null ||
      finish.rank < bestFinish.rank ||
      (finish.rank === bestFinish.rank && finish.players > bestFinish.players)
    ) {
      bestFinish = finish;
    }
  }
  return { played: participations.length, bestFinish };
}
