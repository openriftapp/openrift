import type {
  GroupStageView,
  PodResponse,
  PodRoundResponse,
} from "@openrift/shared/types/api/pod-tournament";
import { describe, expect, it } from "vitest";

import {
  buildBracketColumns,
  collapsedBracketRounds,
  isHigherSeed,
  seedsByPlayer,
} from "./cut-bracket-display";

function makePod(podNumber: number): PodResponse {
  return {
    id: `pod-${podNumber}`,
    podNumber,
    size: 2,
    resultStatus: "pending",
    drawnGames: 0,
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

describe("seedsByPlayer", () => {
  it("maps seeded players and skips unseeded ones", () => {
    const seeds = seedsByPlayer({
      ranking: [
        { playerId: "a", seed: 1 },
        { playerId: "b", seed: null },
      ] as GroupStageView["ranking"],
    });
    expect([...seeds]).toEqual([["a", 1]]);
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

describe("collapsedBracketRounds", () => {
  const finalized = (roundNumber: number, podNumbers: number[]) => ({
    ...makeRound(roundNumber, podNumbers),
    status: "finalized" as const,
  });
  const reported = (round: PodRoundResponse): PodRoundResponse => ({
    ...round,
    pods: round.pods.map((pod) => ({ ...pod, resultStatus: "reported" as const })),
  });

  it("folds every round before the latest drawn one while the cut runs", () => {
    const rounds = [reported(finalized(4, [1, 2, 3, 4])), makeRound(5, [1, 2])];
    expect([...collapsedBracketRounds(buildBracketColumns(rounds, 8))]).toEqual([4]);
  });

  it("keeps a reported round open until the next one is drawn", () => {
    const rounds = [reported(makeRound(4, [1, 2, 3, 4]))];
    expect(collapsedBracketRounds(buildBracketColumns(rounds, 8)).size).toBe(0);
  });

  it("unfolds every round once the final is decided", () => {
    const rounds = [
      reported(finalized(4, [1, 2, 3, 4])),
      reported(finalized(5, [1, 2])),
      reported(finalized(6, [1])),
    ];
    expect(collapsedBracketRounds(buildBracketColumns(rounds, 8)).size).toBe(0);
  });

  it("folds nothing before the cut is drawn", () => {
    expect(collapsedBracketRounds(buildBracketColumns([], 8)).size).toBe(0);
  });
});
