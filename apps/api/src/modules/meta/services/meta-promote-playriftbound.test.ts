import { describe, expect, it, vi } from "vitest";

import type { Repos } from "../../../deps.js";
import type { PlayriftboundListRow } from "../repositories/playriftbound-events.js";
import type {
  PlayriftboundMatchRow,
  PlayriftboundPhaseRow,
  PlayriftboundStandingRow,
} from "../repositories/playriftbound-results.js";
import { promotePhasesAndMatches } from "./meta-promote-matches.js";
import { emptyResult } from "./meta-promote-shared.js";
import { factsFor, playriftboundStandingIdentity } from "./meta-promote-sources.js";

const TOURNAMENT_ID = "117000000000000001";
const NOW = new Date("2026-10-18T12:00:00Z");

const CONTEXT = {
  formatMappings: new Map<string, string>(),
  templateTiers: new Map(),
  competitivePlayerFloor: 128,
};

function listing(overrides: Partial<PlayriftboundListRow> = {}): PlayriftboundListRow {
  return {
    tournamentId: TOURNAMENT_ID,
    organizerId: "org-1",
    name: "Summoner Skirmish",
    // The evening of the 17th in Los Angeles.
    startAt: new Date("2026-10-18T02:00:00Z"),
    tournamentType: "SUMMONER_SKIRMISH",
    format: "LIMITED_SEALED",
    playerFormat: "ONE_V_ONE",
    participantCapacity: 32,
    registeredCount: 20,
    waitlistedCount: 0,
    pricing: "PAID",
    entryFeeCurrency: "USD",
    entryFeeMinor: 1500,
    contentHash: "hash",
    firstSeenAt: NOW,
    lastSeenAt: NOW,
    missingSince: null,
    structure: "SWISS",
    matchFormat: "BO3",
    roundCount: 3,
    roundsPlayed: 3,
    roundsFinalized: 3,
    sourceUpdatedAt: NOW,
    resultsFetchedAt: NOW,
    triage: "accepted",
    metaEventId: "live-1",
    metaEventSlug: "summoner-skirmish",
    organizerName: "Piltover Hobbies",
    organizerCity: "Los Angeles",
    organizerAddress: "1 Hextech Way, Los Angeles, CA 90012, USA",
    organizerLongitude: -118.24,
    nextCheckAt: null,
    checkStage: 1,
    stagedPlayerCount: 2,
    stagedMatchCount: 1,
    ...overrides,
  };
}

function standing(overrides: Partial<PlayriftboundStandingRow> = {}): PlayriftboundStandingRow {
  return {
    tournamentId: TOURNAMENT_ID,
    teamId: "t1",
    playerId: "019f0000-0000-7000-8000-000000000001",
    playerName: "Teemo Main",
    rank: 1,
    wins: 3,
    losses: 0,
    draws: 0,
    matchPoints: 9,
    opponentMatchWinPct: 0.5,
    gameWinPct: 0.75,
    opponentGameWinPct: 0.5,
    entryStatus: null,
    fetchedAt: NOW,
    ...overrides,
  };
}

describe("playriftboundStandingIdentity", () => {
  it("keys a player by the source's player id and a team by its team id, under `o`", () => {
    expect(playriftboundStandingIdentity({ playerId: "019f-abc", teamId: "t1" })).toBe("o019f-abc");
    expect(playriftboundStandingIdentity({ playerId: null, teamId: "117" })).toBe("ot117");
  });
});

describe("playriftbound promotion facts", () => {
  function repos(rows: PlayriftboundStandingRow[], row = listing()) {
    return {
      playriftboundEvents: { byKey: () => Promise.resolve(row) },
      playriftboundResults: { standings: () => Promise.resolve(rows) },
    } as unknown as Repos;
  }

  it("files the event at its store, on the store's local day, with the ranked field as its size", async () => {
    const facts = await factsFor(
      repos([
        standing(),
        standing({ teamId: "t2", playerId: "p2", rank: 2 }),
        standing({ teamId: "t3", playerId: "p3", rank: null }),
      ]),
      "playriftbound",
      TOURNAMENT_ID,
      CONTEXT,
    );
    expect(facts?.event).toEqual({
      name: "Summoner Skirmish",
      eventDate: "2026-10-17",
      format: "freeform",
      playerCount: 2,
      organizer: "Piltover Hobbies",
      notes: null,
      tier: "local",
      country: "US",
      location: "1 Hextech Way, Los Angeles, CA 90012, USA",
    });
    expect(facts?.standings).toHaveLength(2);
    expect(facts?.standings[0]).toMatchObject({
      identity: "o019f0000-0000-7000-8000-000000000001",
      playerName: "Teemo Main",
      rank: 1,
      matchPoints: 9,
      gameWinPct: 0.75,
      legendName: null,
      sourceDeckId: null,
      provider: "playriftbound",
    });
  });

  it("falls back to registrations before any standings exist", async () => {
    const facts = await factsFor(repos([]), "playriftbound", TOURNAMENT_ID, CONTEXT);
    expect(facts?.event.playerCount).toBe(20);
  });

  it("answers null for a tournament the mirror does not hold", async () => {
    const empty = {
      playriftboundEvents: { byKey: () => Promise.resolve(undefined) },
      playriftboundResults: { standings: () => Promise.resolve([]) },
    } as unknown as Repos;
    expect(await factsFor(empty, "playriftbound", TOURNAMENT_ID, CONTEXT)).toBeNull();
  });
});

function phase(): PlayriftboundPhaseRow {
  return {
    tournamentId: TOURNAMENT_ID,
    phaseOrder: 0,
    name: null,
    roundType: "SWISS",
    roundCount: 3,
    maxGameWins: 2,
  };
}

function match(overrides: Partial<PlayriftboundMatchRow> = {}): PlayriftboundMatchRow {
  return {
    tournamentId: TOURNAMENT_ID,
    sourceMatchId: "m1",
    roundId: "s:x:1",
    phaseOrder: 0,
    roundNumber: 1,
    tableNumber: 1,
    isBye: false,
    isDraw: false,
    player1TeamId: "t1",
    player2TeamId: "t2",
    winnerTeamId: "t1",
    gamesWonP1: 2,
    gamesWonP2: 1,
    ...overrides,
  };
}

describe("playriftbound pairings", () => {
  it("seats each team as the live row its standing identity was filed under", async () => {
    const upsertEventMatches = vi.fn(() => Promise.resolve([]));
    const replaceEventPhases = vi.fn(() => Promise.resolve());
    const repos = {
      playriftboundResults: {
        phases: () => Promise.resolve([phase()]),
        matches: () =>
          Promise.resolve([
            match(),
            match({
              sourceMatchId: "bye:s:x:1:t3",
              isBye: true,
              player1TeamId: "t3",
              player2TeamId: null,
              winnerTeamId: "t3",
              tableNumber: null,
            }),
            // A seat with no live row yet is skipped.
            match({ sourceMatchId: "m2", player1TeamId: "t1", player2TeamId: "t9" }),
          ]),
        standings: () =>
          Promise.resolve([
            standing({ teamId: "t1", playerId: "p1" }),
            standing({ teamId: "t2", playerId: "p2" }),
            standing({ teamId: "t3", playerId: null }),
          ]),
      },
      meta: {
        rawStandingsForEvent: () =>
          Promise.resolve([
            { id: "live-p1", sourceIdentity: "op1" },
            { id: "live-p2", sourceIdentity: "op2" },
            { id: "live-t3", sourceIdentity: "ott3" },
          ]),
        phasesForEvent: () => Promise.resolve([]),
        replaceEventPhases,
        matchesForEvent: () => Promise.resolve([]),
        upsertEventMatches,
      },
    } as unknown as Repos;

    const result = emptyResult("live-event");
    await promotePhasesAndMatches(
      repos,
      "live-event",
      [{ provider: "playriftbound", externalId: TOURNAMENT_ID }],
      result,
    );

    expect(replaceEventPhases).toHaveBeenCalledWith("live-event", [
      expect.objectContaining({
        roundType: "SWISS",
        roundCount: 3,
        maxGameWins: 2,
        rankRequired: null,
      }),
    ]);
    expect(upsertEventMatches).toHaveBeenCalledWith([
      expect.objectContaining({
        sourceMatchId: "m1",
        player1Id: "live-p1",
        player2Id: "live-p2",
        winnerId: "live-p1",
        gamesWonP1: 2,
        gamesWonP2: 1,
      }),
      expect.objectContaining({
        sourceMatchId: "bye:s:x:1:t3",
        isBye: true,
        player1Id: "live-t3",
        player2Id: null,
        winnerId: "live-t3",
      }),
    ]);
    expect(result).toMatchObject({ phases: 1, matches: 2 });
  });

  it("keeps the uvsgames pairings when that copy has them", async () => {
    const upsertEventMatches = vi.fn(() => Promise.resolve([]));
    const riotMatches = vi.fn(() => Promise.resolve([match()]));
    const repos = {
      uvsgamesResults: {
        phases: () => Promise.resolve([]),
        matches: () =>
          Promise.resolve([
            {
              externalId: "9911",
              roundId: "r1",
              sourceMatchId: "u-m1",
              phaseOrder: 0,
              roundNumber: 1,
              tableNumber: 1,
              isBye: false,
              isDraw: false,
              player1UvsgamesId: 1,
              player2UvsgamesId: 2,
              winnerUvsgamesId: 1,
              gamesWonP1: 2,
              gamesWonP2: 0,
            },
          ]),
      },
      playriftboundResults: {
        phases: () => Promise.resolve([phase()]),
        matches: riotMatches,
        standings: () => Promise.resolve([]),
      },
      meta: {
        rawStandingsForEvent: () =>
          Promise.resolve([
            { id: "live-u1", sourceIdentity: "u1", uvsgamesPlayerId: 1 },
            { id: "live-u2", sourceIdentity: "u2", uvsgamesPlayerId: 2 },
          ]),
        phasesForEvent: () => Promise.resolve([]),
        replaceEventPhases: () => Promise.resolve(),
        matchesForEvent: () => Promise.resolve([]),
        upsertEventMatches,
      },
    } as unknown as Repos;

    await promotePhasesAndMatches(
      repos,
      "live-event",
      [
        { provider: "uvsgames", externalId: "9911" },
        { provider: "playriftbound", externalId: TOURNAMENT_ID },
      ],
      emptyResult("live-event"),
    );

    expect(riotMatches).not.toHaveBeenCalled();
    expect(upsertEventMatches).toHaveBeenCalledWith([
      expect.objectContaining({ sourceMatchId: "u-m1", player1Id: "live-u1" }),
    ]);
  });

  it("uses the playriftbound pairings when the event's uvsgames copy has phases but none", async () => {
    const upsertEventMatches = vi.fn(() => Promise.resolve([]));
    const repos = {
      uvsgamesResults: {
        phases: () =>
          Promise.resolve([
            {
              phaseOrder: 0,
              name: null,
              roundType: "SWISS",
              roundCount: 5,
              rankRequired: null,
              maxGameWins: 2,
            },
          ]),
        matches: () => Promise.resolve([]),
      },
      playriftboundResults: {
        phases: () => Promise.resolve([phase()]),
        matches: () => Promise.resolve([match()]),
        standings: () =>
          Promise.resolve([
            standing({ teamId: "t1", playerId: "p1" }),
            standing({ teamId: "t2", playerId: "p2" }),
          ]),
      },
      meta: {
        rawStandingsForEvent: () =>
          Promise.resolve([
            { id: "live-p1", sourceIdentity: "op1", uvsgamesPlayerId: null },
            { id: "live-p2", sourceIdentity: "op2", uvsgamesPlayerId: null },
          ]),
        phasesForEvent: () => Promise.resolve([]),
        replaceEventPhases: () => Promise.resolve(),
        matchesForEvent: () => Promise.resolve([]),
        upsertEventMatches,
      },
    } as unknown as Repos;

    const result = emptyResult("live-event");
    await promotePhasesAndMatches(
      repos,
      "live-event",
      [
        { provider: "uvsgames", externalId: "9911" },
        { provider: "playriftbound", externalId: TOURNAMENT_ID },
      ],
      result,
    );

    expect(upsertEventMatches).toHaveBeenCalledWith([
      expect.objectContaining({ sourceMatchId: "m1", player1Id: "live-p1" }),
    ]);
    expect(result).toMatchObject({ phases: 1, matches: 1 });
  });
});
