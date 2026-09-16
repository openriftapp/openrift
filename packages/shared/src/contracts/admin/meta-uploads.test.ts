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
