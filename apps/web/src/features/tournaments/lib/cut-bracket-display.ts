import { GROUP_STAGE_ROUNDS } from "@openrift/shared/pairing/group-cut-types";
import type { CutSize } from "@openrift/shared/pairing/group-cut-types";
import type {
  GroupStageView,
  PodResponse,
  PodRoundResponse,
} from "@openrift/shared/types/api/pod-tournament";

import { cutMatchShortLabel, cutRoundLabels } from "./group-cut-display";

export interface BracketMatch {
  key: string;
  podNumber: number;
  /** Null while the round that holds this slot is not generated yet. */
  pod: PodResponse | null;
  /** The two matches whose winners meet here, for an ungenerated slot. */
  feeders: [string, string] | null;
}

export interface BracketColumn {
  roundNumber: number;
  label: string;
  matches: BracketMatch[];
}

/**
 * Pod number is the bracket slot: pods `2k - 1` and `2k` of a round feed pod
 * `k` of the next, so a round that does not exist yet still has its shape.
 */
export function buildBracketColumns(
  rounds: readonly PodRoundResponse[],
  cutSize: CutSize,
): BracketColumn[] {
  const labels = cutRoundLabels(cutSize);
  const byRoundNumber = new Map(rounds.map((round) => [round.roundNumber, round]));
  return labels.map((label, index) => {
    const roundNumber = GROUP_STAGE_ROUNDS + 1 + index;
    const round = byRoundNumber.get(roundNumber);
    const slotCount = cutSize / 2 ** (index + 1);
    const podByNumber = new Map((round?.pods ?? []).map((pod) => [pod.podNumber, pod]));
    const matches: BracketMatch[] = [];
    for (let slot = 1; slot <= slotCount; slot += 1) {
      matches.push({
        key: `${roundNumber}-${slot}`,
        podNumber: slot,
        pod: podByNumber.get(slot) ?? null,
        feeders:
          index === 0
            ? null
            : [
                cutMatchShortLabel(cutSize, roundNumber - 1, slot * 2 - 1),
                cutMatchShortLabel(cutSize, roundNumber - 1, slot * 2),
              ],
      });
    }
    return { roundNumber, label, matches };
  });
}

export function seedsByPlayer(groupStage: Pick<GroupStageView, "ranking">): Map<string, number> {
  return new Map(
    groupStage.ranking.flatMap((row) => (row.seed === null ? [] : [[row.playerId, row.seed]])),
  );
}

export function isHigherSeed(
  pod: { members: readonly { playerId: string }[] },
  playerId: string,
  seedByPlayer: ReadonlyMap<string, number>,
): boolean {
  const seeds = pod.members.flatMap((member) => {
    const seed = seedByPlayer.get(member.playerId);
    return seed === undefined ? [] : [seed];
  });
  const own = seedByPlayer.get(playerId);
  return own !== undefined && seeds.length > 0 && own === Math.min(...seeds);
}

/** While the cut runs, every round before the latest drawn one; none once the final is decided. */
export function collapsedBracketRounds(columns: readonly BracketColumn[]): Set<number> {
  const final = columns.at(-1)?.matches[0]?.pod;
  if (final?.resultStatus === "reported") {
    return new Set();
  }
  return new Set(
    columns
      .filter((_, index) =>
        columns.slice(index + 1).some((later) => later.matches.some((match) => match.pod)),
      )
      .map((column) => column.roundNumber),
  );
}
