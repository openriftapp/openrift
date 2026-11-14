import { describe, expect, it } from "vitest";

import { cutRounds, groupStageRounds, isGroupStageRound } from "./group-cut-rounds.js";

interface Round {
  roundNumber: number;
}

const roundNumberOf = (round: Round) => round.roundNumber;

function rounds(...numbers: number[]): Round[] {
  return numbers.map((roundNumber) => ({ roundNumber }));
}

function roundNumbers(list: Round[]): number[] {
  return list.map((round) => round.roundNumber);
}

describe("isGroupStageRound", () => {
  it("is true for rounds one to three only", () => {
    expect([1, 2, 3, 4, 5].map((round) => isGroupStageRound(round))).toEqual([
      true,
      true,
      true,
      false,
      false,
    ]);
  });
});

describe("round split", () => {
  it("keeps rounds one to three in the group stage and the rest in the cut", () => {
    const list = rounds(1, 3, 4, 5);
    expect(roundNumbers(groupStageRounds(list, roundNumberOf))).toEqual([1, 3]);
    expect(roundNumbers(cutRounds(list, roundNumberOf))).toEqual([4, 5]);
  });

  it("orders the cut rounds by number whatever order they arrive in", () => {
    expect(roundNumbers(cutRounds(rounds(6, 4, 5), roundNumberOf))).toEqual([4, 5, 6]);
  });

  it("keeps the group-stage rounds in their given order", () => {
    expect(roundNumbers(groupStageRounds(rounds(3, 1, 2), roundNumberOf))).toEqual([3, 1, 2]);
  });

  it("reads the round number through the given accessor", () => {
    const nested = [{ round: { roundNumber: 5 } }, { round: { roundNumber: 2 } }];
    expect(cutRounds(nested, (rows) => rows.round.roundNumber)).toEqual([nested[0]]);
  });
});
