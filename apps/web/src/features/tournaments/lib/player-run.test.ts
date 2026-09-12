import type { PodRoundResponse } from "@openrift/shared/types/api/pod-tournament";
import { describe, expect, it } from "vitest";

import { bestFinishPerLegend, latestSnapshotRound, playerRunRounds } from "./player-run";

function round(
  roundNumber: number,
  pods: [string, number | null, string, number | null][],
  byes: string[] = [],
): PodRoundResponse {
  return {
    id: `r-${roundNumber}`,
    roundNumber,
    status: "finalized",
    pairingStrategy: "swiss",
    penaltyTotal: null,
    createdAt: "2026-09-09T10:00:00Z",
    finalizedAt: null,
    pods: pods.map(([a, placeA, b, placeB], index) => ({
      id: `p-${roundNumber}-${index}`,
      podNumber: index + 1,
      size: 2,
      resultStatus: placeA === null ? "pending" : "reported",
      penalty: null,
      members: [
        {
          playerId: a,
          displayName: a,
          teamId: null,
          gamePoints: 2,
          placement: placeA,
          points: null,
        },
        {
          playerId: b,
          displayName: b,
          teamId: null,
          gamePoints: 1,
          placement: placeB,
          points: null,
        },
      ],
    })),
    byes: byes.map((playerId) => ({ playerId, displayName: playerId })),
  };
}

describe("playerRunRounds", () => {
  it("reads win, loss, draw, bye and open rounds in order and marks the cut", () => {
    const rounds = [
      round(2, [["Ashe", 1, "Jinx", 2]]),
      round(1, [["Jinx", 1, "Ashe", 2]]),
      round(3, [["Ashe", 1, "Sett", 1]]),
      round(4, [["Jinx", 1, "Sett", 2]], ["Ashe"]),
      round(5, [["Ashe", null, "Jinx", null]]),
    ];
    expect(
      playerRunRounds(rounds, "Ashe", true).map((entry) => [entry.outcome, entry.isCut]),
    ).toEqual([
      ["loss", false],
      ["win", false],
      ["draw", false],
      ["bye", true],
      ["unknown", true],
    ]);
    expect(playerRunRounds(rounds, "Sett", false)).toHaveLength(2);
  });
});

describe("latestSnapshotRound", () => {
  it("ignores the open round and an empty list", () => {
    const rounds = [round(1, []), round(3, []), { ...round(2, []), status: "reporting" as const }];
    expect(latestSnapshotRound(rounds, false)).toBe(3);
    expect(latestSnapshotRound([], false)).toBe(0);
  });

  it("counts a fully reported group round that is not finalized yet", () => {
    const reported = { ...round(2, [["Ashe", 1, "Jinx", 2]]), status: "reporting" as const };
    const open = { ...round(3, [["Ashe", null, "Jinx", null]]), status: "reporting" as const };
    expect(latestSnapshotRound([reported, open], true)).toBe(2);
    expect(latestSnapshotRound([reported, open], false)).toBe(0);
  });
});

describe("bestFinishPerLegend", () => {
  it("keeps the best-placed player per Legend, counts its players, and skips players without one", () => {
    const finishes = bestFinishPerLegend(
      [
        { playerId: "p3", displayName: "P3", place: 3 },
        { playerId: "p1", displayName: "P1", place: 1 },
        { playerId: "p2", displayName: "P2", place: 2 },
        { playerId: "p4", displayName: "P4", place: 4 },
      ],
      new Map([
        ["p1", "jinx"],
        ["p2", "jinx"],
        ["p3", "sett"],
        ["p4", null],
      ]),
    );
    expect(finishes).toEqual([
      { legendCardId: "jinx", playerId: "p1", displayName: "P1", place: 1, playerCount: 2 },
      { legendCardId: "sett", playerId: "p3", displayName: "P3", place: 3, playerCount: 1 },
    ]);
  });
});
