import { GROUP_STAGE_ROUNDS } from "./group-cut-types.js";

export function isGroupStageRound(roundNumber: number): boolean {
  return roundNumber <= GROUP_STAGE_ROUNDS;
}

export function groupStageRounds<T>(
  rounds: readonly T[],
  roundNumberOf: (round: T) => number,
): T[] {
  return rounds.filter((round) => isGroupStageRound(roundNumberOf(round)));
}

export function cutRounds<T>(rounds: readonly T[], roundNumberOf: (round: T) => number): T[] {
  return rounds
    .filter((round) => !isGroupStageRound(roundNumberOf(round)))
    .toSorted((a, b) => roundNumberOf(a) - roundNumberOf(b));
}
