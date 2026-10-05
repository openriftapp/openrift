import type { PodStandingRow } from "@openrift/shared/types/api/pod-tournament";
import { describe, expect, it } from "vitest";

import {
  decidingTieBreak,
  formatMatchRecord,
  formatPlayerRecord,
  formatScore,
  rankedStandings,
  standingRanks,
} from "./standings-display";

function makeRow(playerId: string, overrides: Partial<PodStandingRow> = {}): PodStandingRow {
  return {
    playerId,
    displayName: `Player ${playerId}`,
    image: null,
    gravatarHash: null,
    status: "active",
    droppedAfterRound: null,
    teamId: null,
    score: 0,
    gamePoints: 0,
    roundsPlayed: 1,
    pods3Count: 0,
    pods4Count: 0,
    byeCount: 0,
    podWins: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    region: null,
    avgOpponentScore: 0,
    avgOpponentGamePoints: 0,
    ...overrides,
  };
}

describe("formatScore", () => {
  it("keeps whole scores integral and averages to two decimals", () => {
    expect(formatScore(6)).toBe("6");
    expect(formatScore(1.75)).toBe("1.75");
    expect(formatScore(1.3333333)).toBe("1.33");
  });
});

describe("standingRanks", () => {
  it("numbers a strictly ordered field 1, 2, 3", () => {
    const ranks = standingRanks([
      makeRow("a", { score: 9 }),
      makeRow("b", { score: 6 }),
      makeRow("c", { score: 3 }),
    ]);
    expect(ranks).toEqual([1, 2, 3]);
  });

  it("shares a rank between players level on points and skips the next", () => {
    const ranks = standingRanks([
      makeRow("a", { score: 9 }),
      makeRow("b", { score: 9 }),
      makeRow("c", { score: 3 }),
    ]);
    expect(ranks).toEqual([1, 1, 3]);
  });

  it("returns no ranks for an empty field", () => {
    expect(standingRanks([])).toEqual([]);
  });

  it("keeps sharing a rank across a three-way tie", () => {
    const ranks = standingRanks([
      makeRow("a", { score: 6 }),
      makeRow("b", { score: 6 }),
      makeRow("c", { score: 6 }),
      makeRow("d", { score: 0 }),
    ]);
    expect(ranks).toEqual([1, 1, 1, 4]);
  });
});

describe("rankedStandings", () => {
  it("pairs each row with its rank in the given order", () => {
    const a = makeRow("a", { score: 9 });
    const b = makeRow("b", { score: 9 });
    const c = makeRow("c", { score: 3 });
    expect(rankedStandings([a, b, c])).toEqual([
      { row: a, rank: 1 },
      { row: b, rank: 1 },
      { row: c, rank: 3 },
    ]);
  });
});

describe("formatMatchRecord", () => {
  it("prints wins, losses and draws", () => {
    expect(formatMatchRecord({ wins: 2, losses: 1, draws: 1 })).toBe("2-1-1");
  });

  it("prints a zero record rather than going blank", () => {
    expect(formatMatchRecord({ wins: 0, losses: 0, draws: 0 })).toBe("0-0-0");
  });
});

describe("formatPlayerRecord", () => {
  it("keeps W-L-D for Swiss, where the engine actually counts one", () => {
    expect(formatPlayerRecord(makeRow("a", { wins: 3, losses: 1, draws: 0 }), true)).toBe("3-1-0");
  });

  it("counts pod wins on a pod event, where W-L-D would read 0-0-0 for everyone", () => {
    const row = makeRow("a", { podWins: 2, wins: 0, draws: 0, losses: 0 });
    expect(formatPlayerRecord(row, false)).toBe("2 pod wins");
  });

  it("singularizes a lone pod win", () => {
    expect(formatPlayerRecord(makeRow("a", { podWins: 1 }), false)).toBe("1 pod win");
  });

  it("says zero rather than going blank for a winless player", () => {
    expect(formatPlayerRecord(makeRow("a", { podWins: 0 }), false)).toBe("0 pod wins");
  });
});

describe("decidingTieBreak", () => {
  it("names the opponent average when it separated two level players", () => {
    const leader = makeRow("a", { score: 6, avgOpponentScore: 1.75 });
    const rival = makeRow("b", { score: 6, avgOpponentScore: 1 });
    expect(decidingTieBreak(leader, rival)).toBe("opp 1.75");
    expect(decidingTieBreak(rival, leader)).toBe("opp 1");
  });

  it("falls through to game points when the opponent averages match", () => {
    const leader = makeRow("a", { score: 6, gamePoints: 12 });
    const rival = makeRow("b", { score: 6, gamePoints: 9 });
    expect(decidingTieBreak(leader, rival)).toBe("12 game pts");
  });

  it("stays quiet when the players aren't level on points", () => {
    expect(
      decidingTieBreak(makeRow("a", { score: 9 }), makeRow("b", { score: 6, avgOpponentScore: 1 })),
    ).toBeNull();
  });

  it("stays quiet when the win count decided it, since the seat already shows it", () => {
    const leader = makeRow("a", { score: 6, podWins: 2, avgOpponentScore: 1.75 });
    const rival = makeRow("b", { score: 6, podWins: 1, avgOpponentScore: 1 });
    expect(decidingTieBreak(leader, rival)).toBeNull();
  });

  it("stays quiet when every tie-break matched and the order is arbitrary", () => {
    expect(decidingTieBreak(makeRow("a", { score: 6 }), makeRow("b", { score: 6 }))).toBeNull();
  });
});
