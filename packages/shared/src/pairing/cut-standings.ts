export interface CutStandingsRanking {
  playerId: string;
  seed: number | null;
}

export interface CutStandingsRound {
  roundNumber: number;
  pods: { members: { playerId: string; placement: number | null }[] }[];
}

export interface FinalStandingPlace {
  playerId: string;
  place: number;
  /** The cut round the player lost in; null for the champion and for players who missed the cut. */
  exitRound: number | null;
}

function podWinner(members: readonly { playerId: string; placement: number | null }[]) {
  return members.find((member) => member.placement === 1)?.playerId;
}

/**
 * Champion, then the final's loser, then each earlier cut round's losers by seed,
 * then everyone who missed the cut in qualification order. Null until the final
 * has a winner.
 */
export function finalStandings(
  ranking: readonly CutStandingsRanking[],
  cutRounds: readonly CutStandingsRound[],
): FinalStandingPlace[] | null {
  const rounds = cutRounds.toSorted((a, b) => a.roundNumber - b.roundNumber);
  const last = rounds.at(-1);
  const finalPod = last?.pods.length === 1 ? last.pods[0] : undefined;
  const champion = finalPod === undefined ? undefined : podWinner(finalPod.members);
  if (champion === undefined) {
    return null;
  }

  const seedOf = new Map(ranking.map((row) => [row.playerId, row.seed ?? Number.MAX_SAFE_INTEGER]));
  const placed = new Set<string>([champion]);
  const out: FinalStandingPlace[] = [{ playerId: champion, place: 1, exitRound: null }];
  for (const round of rounds.toReversed()) {
    const losers = round.pods
      .flatMap((pod) => pod.members.filter((member) => member.playerId !== podWinner(pod.members)))
      .map((member) => member.playerId)
      .filter((playerId) => !placed.has(playerId))
      .toSorted(
        (a, b) =>
          (seedOf.get(a) ?? Number.MAX_SAFE_INTEGER) - (seedOf.get(b) ?? Number.MAX_SAFE_INTEGER),
      );
    for (const playerId of losers) {
      placed.add(playerId);
      out.push({ playerId, place: out.length + 1, exitRound: round.roundNumber });
    }
  }
  for (const row of ranking) {
    if (!placed.has(row.playerId)) {
      placed.add(row.playerId);
      out.push({ playerId: row.playerId, place: out.length + 1, exitRound: null });
    }
  }
  return out;
}
