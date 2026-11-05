import type { PodResponse, PodRoundResponse } from "@openrift/shared/types/api/pod-tournament";
import { describe, expect, it } from "vitest";

import {
  buildBracketColumns,
  cutRounds,
  defaultBracketRound,
  groupStageRounds,
  isHigherSeed,
} from "./cut-bracket-display";

function makePod(podNumber: number): PodResponse {
  return {
    id: `pod-${podNumber}`,
    podNumber,
    size: 2,
    resultStatus: "pending",
    members: [],
    penalty: null,
  };
}

function makeRound(roundNumber: number, podNumbers: number[]): PodRoundResponse {
  return {
    id: `r-${roundNumber}`,
    roundNumber,
    status: "reporting",
    pairingStrategy: "swiss",
    penaltyTotal: null,
    createdAt: "2026-09-09T10:00:00Z",
    finalizedAt: null,
    pods: podNumbers.map((podNumber) => makePod(podNumber)),
    byes: [],
  };
}

describe("buildBracketColumns", () => {
  it("halves the slot count each column", () => {
    const columns = buildBracketColumns([], 8);
    expect(columns.map((column) => column.matches.length)).toEqual([4, 2, 1]);
    expect(columns.map((column) => column.label)).toEqual(["Quarterfinals", "Semifinals", "Final"]);
  });

  it("fills a slot from the round's pod of the same number", () => {
    const columns = buildBracketColumns([makeRound(4, [1, 2, 3, 4])], 8);
    expect(columns[0]?.matches.map((match) => match.pod?.id)).toEqual([
      "pod-1",
      "pod-2",
      "pod-3",
      "pod-4",
    ]);
    expect(columns[1]?.matches.every((match) => match.pod === null)).toBe(true);
  });

  it("points an empty later slot at the two matches that feed it", () => {
    const columns = buildBracketColumns([], 8);
    expect(columns[0]?.matches[0]?.feeders).toBeNull();
    expect(columns[1]?.matches[0]?.feeders).toEqual(["QF 1", "QF 2"]);
    expect(columns[1]?.matches[1]?.feeders).toEqual(["QF 3", "QF 4"]);
    expect(columns[2]?.matches[0]?.feeders).toEqual(["SF 1", "SF 2"]);
  });

  it("starts a top 4 at the semifinals", () => {
    const columns = buildBracketColumns([], 4);
    expect(columns.map((column) => column.roundNumber)).toEqual([4, 5]);
    expect(columns[1]?.matches[0]?.feeders).toEqual(["SF 1", "SF 2"]);
  });
});

describe("round split", () => {
  it("keeps rounds one to three in the group stage and the rest in the cut", () => {
    const rounds = [makeRound(1, [1]), makeRound(3, [1]), makeRound(4, [1]), makeRound(5, [1])];
    expect(groupStageRounds(rounds).map((round) => round.roundNumber)).toEqual([1, 3]);
    expect(cutRounds(rounds).map((round) => round.roundNumber)).toEqual([4, 5]);
  });
});

describe("isHigherSeed", () => {
  const pod = { members: [{ playerId: "Ashe" }, { playerId: "Jinx" }] };

  it("is true only for the lowest seed in the pod", () => {
    const seeds = new Map([
      ["Ashe", 3],
      ["Jinx", 2],
    ]);
    expect(isHigherSeed(pod, "Jinx", seeds)).toBe(true);
    expect(isHigherSeed(pod, "Ashe", seeds)).toBe(false);
  });

  it("ignores members without a seed", () => {
    expect(isHigherSeed(pod, "Ashe", new Map([["Ashe", 4]]))).toBe(true);
  });

  it("is false for an unseeded player", () => {
    expect(isHigherSeed(pod, "Jinx", new Map([["Ashe", 4]]))).toBe(false);
    expect(isHigherSeed(pod, "Jinx", new Map())).toBe(false);
  });
});

describe("defaultBracketRound", () => {
  const finalized = (roundNumber: number) => ({
    ...makeRound(roundNumber, [1]),
    status: "finalized" as const,
  });

  it("opens a completed event on its final", () => {
    const rounds = [finalized(4), finalized(5), finalized(6)];
    expect(defaultBracketRound(buildBracketColumns(rounds, 8), rounds, true)).toBe(6);
  });

  it("opens a completed event on its final even when a round is still marked open", () => {
    const rounds = [finalized(4), makeRound(5, [1, 2]), finalized(6)];
    expect(defaultBracketRound(buildBracketColumns(rounds, 8), rounds, true)).toBe(6);
  });

  it("has no round to open for a completed event without a bracket", () => {
    expect(defaultBracketRound([], [], true)).toBeUndefined();
  });

  it("picks the round that takes results", () => {
    const rounds = [finalized(4), makeRound(5, [1, 2])];
    expect(defaultBracketRound(buildBracketColumns(rounds, 8), rounds, false)).toBe(5);
  });

  it("falls back to the latest drawn round when none is open", () => {
    const rounds = [finalized(4), finalized(5)];
    expect(defaultBracketRound(buildBracketColumns(rounds, 8), rounds, false)).toBe(5);
  });

  it("falls back to the first round before the cut is drawn", () => {
    expect(defaultBracketRound(buildBracketColumns([], 8), [], false)).toBe(4);
  });
});
