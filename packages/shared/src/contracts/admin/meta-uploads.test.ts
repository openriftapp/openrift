import { describe, expect, it } from "vitest";

import { metaUploadSchema } from "./meta-uploads.js";

function parse(event: Record<string, unknown>) {
  return metaUploadSchema.safeParse({ provider: "push", events: [{ ...base, ...event }] });
}

const base = {
  externalId: "evt-1",
  name: "Summoner Skirmish",
  eventDate: "2026-08-15",
  format: "constructed",
  players: [
    { externalId: "p1", playerName: "Ashe", rank: 1 },
    { externalId: "p2", playerName: "Riven", rank: 2 },
  ],
};

const pairing = {
  externalId: "m1",
  roundNumber: 1,
  player1ExternalId: "p1",
  player2ExternalId: "p2",
  winnerExternalId: "p1",
};

describe("metaUploadSchema structure", () => {
  it("leaves an event with no bracket carrying empty phases and matches", () => {
    const result = parse({});
    expect(result.success).toBe(true);
    expect(result.data?.events[0]).toMatchObject({ phases: [], matches: [] });
  });

  it("defaults a match to the first phase, not a bye and not a draw", () => {
    const result = parse({ matches: [pairing] });
    expect(result.data?.events[0]?.matches[0]).toMatchObject({
      phaseOrder: 0,
      isBye: false,
      isDraw: false,
      tableNumber: null,
      roundExternalId: null,
    });
  });

  it("accepts a bye that names no opponent and no winner", () => {
    const result = parse({
      matches: [
        {
          externalId: "m2",
          roundNumber: 1,
          isBye: true,
          player1ExternalId: "p1",
          winnerExternalId: "p1",
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a bye that names an opponent", () => {
    expect(parse({ matches: [{ ...pairing, isBye: true }] }).success).toBe(false);
  });

  it("rejects a pairing that names no opponent and is not a bye", () => {
    expect(
      parse({ matches: [{ ...pairing, player2ExternalId: null, winnerExternalId: "p1" }] }).success,
    ).toBe(false);
  });

  it("rejects a bye recorded as a draw", () => {
    expect(
      parse({
        matches: [
          {
            externalId: "m3",
            roundNumber: 1,
            isBye: true,
            isDraw: true,
            player1ExternalId: "p1",
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects a winner who is neither of the match's players", () => {
    expect(parse({ matches: [{ ...pairing, winnerExternalId: "p3" }] }).success).toBe(false);
  });

  it("accepts a draw with no winner named", () => {
    const result = parse({
      matches: [{ ...pairing, isDraw: true, winnerExternalId: null }],
    });
    expect(result.success).toBe(true);
    expect(result.data?.events[0]?.matches[0]).toMatchObject({
      isDraw: true,
      winnerExternalId: null,
    });
  });

  it("keeps a phase's cut size and match length", () => {
    const result = parse({
      phases: [
        { phaseOrder: 0, roundType: "swiss", roundCount: 9 },
        { phaseOrder: 1, name: "Top 8", roundType: "single_elim", rankRequired: 8, maxGameWins: 2 },
      ],
    });
    expect(result.data?.events[0]?.phases).toEqual([
      {
        phaseOrder: 0,
        name: null,
        roundType: "swiss",
        roundCount: 9,
        rankRequired: null,
        maxGameWins: null,
      },
      {
        phaseOrder: 1,
        name: "Top 8",
        roundType: "single_elim",
        roundCount: null,
        rankRequired: 8,
        maxGameWins: 2,
      },
    ]);
  });

  it("rejects a round number below one", () => {
    expect(parse({ matches: [{ ...pairing, roundNumber: 0 }] }).success).toBe(false);
  });
});

describe("metaUploadSchema numeric bounds", () => {
  function playerIssuePaths(player: Record<string, unknown>) {
    const result = parse({
      players: [{ externalId: "p1", playerName: "Ashe", rank: 1, ...player }],
    });
    return result.error?.issues.map((issue) => issue.path.join("."));
  }

  it("rejects a rank above the player cap, naming the field", () => {
    expect(playerIssuePaths({ rank: 100_001 })).toEqual(["events.0.players.0.rank"]);
  });

  it("rejects a fractional or zero rank", () => {
    expect(playerIssuePaths({ rank: 1.5 })).toEqual(["events.0.players.0.rank"]);
    expect(playerIssuePaths({ rank: 0 })).toEqual(["events.0.players.0.rank"]);
  });

  it("rejects a record count outside the smallint range", () => {
    expect(playerIssuePaths({ wins: 32_768 })).toEqual(["events.0.players.0.wins"]);
    expect(playerIssuePaths({ losses: -1 })).toEqual(["events.0.players.0.losses"]);
    expect(playerIssuePaths({ draws: 40_000 })).toEqual(["events.0.players.0.draws"]);
  });

  it("rejects match points above the integer range", () => {
    expect(playerIssuePaths({ matchPoints: 2_147_483_648 })).toEqual([
      "events.0.players.0.matchPoints",
    ]);
  });

  it("accepts the largest values the columns hold", () => {
    expect(
      playerIssuePaths({ rank: 100_000, wins: 32_767, matchPoints: 2_147_483_647 }),
    ).toBeUndefined();
  });

  it("rejects a tiebreaker outside 0 to 1", () => {
    expect(playerIssuePaths({ gameWinPct: 1.2 })).toEqual(["events.0.players.0.gameWinPct"]);
    expect(playerIssuePaths({ opponentMatchWinPct: -0.1 })).toEqual([
      "events.0.players.0.opponentMatchWinPct",
    ]);
    expect(playerIssuePaths({ opponentGameWinPct: 2 })).toEqual([
      "events.0.players.0.opponentGameWinPct",
    ]);
    expect(playerIssuePaths({ gameWinPct: 0.5, opponentGameWinPct: 1 })).toBeUndefined();
  });

  it("rejects a card quantity below one or fractional", () => {
    const card = (quantity: number) => ({
      cards: [{ name: "Poro Snack", zone: "main", quantity }],
    });
    expect(playerIssuePaths(card(0))).toEqual(["events.0.players.0.cards.0.quantity"]);
    expect(playerIssuePaths(card(1.5))).toEqual(["events.0.players.0.cards.0.quantity"]);
  });

  it("rejects a player count of zero", () => {
    const result = parse({ playerCount: 0 });
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toEqual([
      "events.0.playerCount",
    ]);
    expect(parse({ playerCount: 1 }).success).toBe(true);
  });

  it("rejects a match length above the smallint range", () => {
    const result = parse({
      phases: [{ phaseOrder: 0, roundType: "swiss", maxGameWins: 32_768 }],
    });
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toEqual([
      "events.0.phases.0.maxGameWins",
    ]);
  });
});
