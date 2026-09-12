import { describe, expect, it } from "vitest";

import type { CutStandingsRound } from "./cut-standings";
import { finalStandings } from "./cut-standings";

function ranking(count: number, cutSize: number) {
  return Array.from({ length: count }, (_, index) => ({
    playerId: `p${index + 1}`,
    seed: index < cutSize ? index + 1 : null,
  }));
}

function pod(winner: string, loser: string) {
  return {
    members: [
      { playerId: winner, placement: 1 },
      { playerId: loser, placement: 2 },
    ],
  };
}

const top8: CutStandingsRound[] = [
  { roundNumber: 4, pods: [pod("p1", "p8"), pod("p5", "p4"), pod("p7", "p2"), pod("p3", "p6")] },
  { roundNumber: 5, pods: [pod("p5", "p1"), pod("p3", "p7")] },
  { roundNumber: 6, pods: [pod("p3", "p5")] },
];

describe("finalStandings", () => {
  it("orders the champion, the finalist, then each round's losers by seed, then the rest", () => {
    const rows = finalStandings(ranking(12, 8), top8);
    expect(rows?.map((row) => [row.playerId, row.place, row.exitRound])).toEqual([
      ["p3", 1, null],
      ["p5", 2, 6],
      ["p1", 3, 5],
      ["p7", 4, 5],
      ["p2", 5, 4],
      ["p4", 6, 4],
      ["p6", 7, 4],
      ["p8", 8, 4],
      ["p9", 9, null],
      ["p10", 10, null],
      ["p11", 11, null],
      ["p12", 12, null],
    ]);
  });

  it("handles a top 4 and a top 16", () => {
    const top4 = finalStandings(ranking(6, 4), [
      { roundNumber: 4, pods: [pod("p4", "p1"), pod("p2", "p3")] },
      { roundNumber: 5, pods: [pod("p2", "p4")] },
    ]);
    expect(top4?.map((row) => row.playerId)).toEqual(["p2", "p4", "p1", "p3", "p5", "p6"]);

    const r16 = Array.from({ length: 8 }, (_, index) => pod(`p${index + 1}`, `p${16 - index}`));
    const top16 = finalStandings(ranking(16, 16), [
      { roundNumber: 4, pods: r16 },
      {
        roundNumber: 5,
        pods: [pod("p1", "p8"), pod("p4", "p5"), pod("p2", "p7"), pod("p3", "p6")],
      },
      { roundNumber: 6, pods: [pod("p1", "p4"), pod("p2", "p3")] },
      { roundNumber: 7, pods: [pod("p1", "p2")] },
    ]);
    expect(top16?.slice(0, 5).map((row) => row.playerId)).toEqual(["p1", "p2", "p3", "p4", "p5"]);
    expect(top16?.at(-1)).toEqual({ playerId: "p16", place: 16, exitRound: 4 });
  });

  it("is null while the bracket is unfinished or the final has no winner", () => {
    expect(finalStandings(ranking(8, 8), [])).toBeNull();
    expect(finalStandings(ranking(8, 8), top8.slice(0, 2))).toBeNull();
    const openFinal = {
      roundNumber: 6,
      pods: [
        {
          members: [
            { playerId: "p3", placement: null },
            { playerId: "p5", placement: null },
          ],
        },
      ],
    };
    expect(finalStandings(ranking(8, 8), [...top8.slice(0, 2), openFinal])).toBeNull();
  });

  it("places a walkover loser like any other loser", () => {
    const rows = finalStandings(ranking(4, 4), [
      { roundNumber: 4, pods: [pod("p1", "p4"), pod("p3", "p2")] },
      { roundNumber: 5, pods: [pod("p1", "p3")] },
    ]);
    expect(rows?.map((row) => row.playerId)).toEqual(["p1", "p3", "p2", "p4"]);
  });
});
