import { GROUP_STAGE_ROUNDS } from "@openrift/shared/pairing/group-cut-types";
import type { GroupStageView, PodRoundResponse } from "@openrift/shared/types/api/pod-tournament";

import type { MetaPlayerRound, MetaRoundOutcome } from "@/features/meta/lib/meta-player-run";

export interface PlayerLegend {
  legendCardId: string | null;
  legendName: string | null;
}

export function legendsByPlayer(groupStage: GroupStageView | null): Map<string, PlayerLegend> {
  return new Map(
    (groupStage?.groups ?? []).flatMap((group) =>
      group.standings.map((row) => [
        row.playerId,
        { legendCardId: row.legendCardId, legendName: row.legendName },
      ]),
    ),
  );
}

function outcomeOf(
  members: readonly { playerId: string; placement: number | null }[],
  playerId: string,
): MetaRoundOutcome {
  const own = members.find((member) => member.playerId === playerId)?.placement ?? null;
  if (own === null) {
    return "unknown";
  }
  if (members.every((member) => member.placement === own)) {
    return "draw";
  }
  return own === 1 ? "win" : "loss";
}

/** Finalized and reporting rounds alike; a round the player sat out entirely is skipped. */
export function playerRunRounds(
  rounds: readonly PodRoundResponse[],
  playerId: string,
  hasCut: boolean,
): MetaPlayerRound[] {
  return rounds
    .toSorted((a, b) => a.roundNumber - b.roundNumber)
    .flatMap((round): MetaPlayerRound[] => {
      const isCut = hasCut && round.roundNumber > GROUP_STAGE_ROUNDS;
      const base = { phaseOrder: isCut ? 1 : 0, roundNumber: round.roundNumber, isCut };
      if (round.byes.some((bye) => bye.playerId === playerId)) {
        return [
          {
            ...base,
            tableNumber: null,
            outcome: "bye",
            gamesWon: null,
            gamesLost: null,
            opponentId: null,
          },
        ];
      }
      const pod = round.pods.find((entry) =>
        entry.members.some((member) => member.playerId === playerId),
      );
      if (pod === undefined) {
        return [];
      }
      const own = pod.members.find((member) => member.playerId === playerId);
      const opponent = pod.members.find((member) => member.playerId !== playerId);
      return [
        {
          ...base,
          tableNumber: pod.podNumber,
          outcome: outcomeOf(pod.members, playerId),
          gamesWon: own?.gamePoints ?? null,
          gamesLost: pod.members.length === 2 ? (opponent?.gamePoints ?? null) : null,
          opponentId: pod.members.length === 2 ? (opponent?.playerId ?? null) : null,
        },
      ];
    });
}

/**
 * Group rounds stay "reporting" until the cut is generated, so for that format a
 * round counts once every pod is reported; elsewhere it must be finalized.
 */
export function latestSnapshotRound(
  rounds: readonly PodRoundResponse[],
  groupCut: boolean,
): number {
  return rounds.reduce((highest, round) => {
    const done =
      round.status === "finalized" ||
      (groupCut &&
        round.pods.length > 0 &&
        round.pods.every((pod) => pod.resultStatus === "reported"));
    return done ? Math.max(highest, round.roundNumber) : highest;
  }, 0);
}

export interface LegendFinish {
  legendCardId: string;
  playerId: string;
  displayName: string;
  place: number;
  playerCount: number;
}

/** One entry per Legend, carrying the best-placed player who brought it, in place order. */
export function bestFinishPerLegend(
  places: readonly { playerId: string; displayName: string; place: number }[],
  legendByPlayer: ReadonlyMap<string, string | null>,
): LegendFinish[] {
  const best = new Map<string, LegendFinish>();
  for (const entry of places.toSorted((a, b) => a.place - b.place)) {
    const legendCardId = legendByPlayer.get(entry.playerId) ?? null;
    if (legendCardId === null) {
      continue;
    }
    const existing = best.get(legendCardId);
    if (existing === undefined) {
      best.set(legendCardId, { legendCardId, ...entry, playerCount: 1 });
    } else {
      existing.playerCount += 1;
    }
  }
  return [...best.values()];
}
