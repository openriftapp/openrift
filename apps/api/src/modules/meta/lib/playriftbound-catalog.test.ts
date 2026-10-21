import { describe, expect, it } from "vitest";

import {
  cellOf,
  cellsBetween,
  isTeamFormat,
  playriftboundDisplayStatus,
  phasesToStore,
  playriftboundFormat,
  projectSearchResult,
  projectTournamentDetail,
  SEARCH_RADIUS_METERS,
} from "./playriftbound-catalog.js";

const ORGANIZER = {
  id: "019f0000-0000-7000-8000-000000000001",
  name: "Bandle City Games",
  physicalAddress: {
    city: "Bandle City",
    adminArea1: "BC",
    formattedAddress: "1 Yordle Lane, 12345 Bandle City, Germany",
    latitude: 52.37,
    longitude: 9.73,
  },
};

function searchNode(overrides: Record<string, unknown> = {}) {
  return {
    distanceMeters: 1200,
    organizer: ORGANIZER,
    tournament: {
      id: "117000000000000001",
      name: "Summoner Skirmish",
      startsAt: "2026-10-18T15:00:00Z",
      pricing: "PAID",
      entryFee: { currency: "EUR", minorUnits: 1000 },
      registrantCounts: [
        { status: "REGISTERED", count: 14 },
        { status: "WAITLISTED", count: 2 },
      ],
      config: {
        tournamentType: "SUMMONER_SKIRMISH",
        format: "CONSTRUCTED",
        playerFormat: "ONE_V_ONE",
        participantCapacity: 16,
      },
      ...overrides,
    },
  };
}

describe("projectSearchResult", () => {
  it("projects the event and its organizer", () => {
    const projected = projectSearchResult(searchNode());
    expect(projected?.event).toMatchObject({
      tournamentId: "117000000000000001",
      organizerId: ORGANIZER.id,
      name: "Summoner Skirmish",
      startAt: new Date("2026-10-18T15:00:00Z"),
      tournamentType: "SUMMONER_SKIRMISH",
      format: "CONSTRUCTED",
      playerFormat: "ONE_V_ONE",
      participantCapacity: 16,
      registeredCount: 14,
      waitlistedCount: 2,
      pricing: "PAID",
      entryFeeCurrency: "EUR",
      entryFeeMinor: 1000,
    });
    expect(projected?.organizer).toEqual({
      id: ORGANIZER.id,
      name: "Bandle City Games",
      city: "Bandle City",
      adminArea: "BC",
      address: "1 Yordle Lane, 12345 Bandle City, Germany",
      latitude: 52.37,
      longitude: 9.73,
    });
  });

  it("reads an absent registrant status as zero", () => {
    const projected = projectSearchResult(
      searchNode({ registrantCounts: [{ status: "REGISTERED", count: 3 }] }),
    );
    expect(projected?.event.waitlistedCount).toBe(0);
  });

  it("drops a row with no numeric id or no start", () => {
    expect(projectSearchResult(searchNode({ id: "not-a-snowflake" }))).toBeNull();
    expect(projectSearchResult(searchNode({ startsAt: null }))).toBeNull();
  });

  it("hashes listing content, so a registration change reads as a change", () => {
    const before = projectSearchResult(searchNode());
    const after = projectSearchResult(
      searchNode({ registrantCounts: [{ status: "REGISTERED", count: 15 }] }),
    );
    expect(before?.event.contentHash).not.toBe(after?.event.contentHash);
  });
});

function participant(teamId: string, playerId: string, name: string, status = "ACTIVE") {
  return {
    esportsTeamId: teamId,
    id: `p-${teamId}`,
    status,
    player: { id: playerId, displayName: name },
  };
}

function standing(teamId: string, rank: number, wins: number, losses: number) {
  return {
    esportsTeamId: teamId,
    rank,
    matchWins: wins,
    matchLosses: losses,
    matchDraws: 0,
    matchPoints: wins * 3,
    gameWinPercentage: "0.5",
    opponentMatchWinPercentage: "0.4444444444444444",
    opponentGameWinPercentage: "0.5",
  };
}

function game(number: number, winner: string, loser: string) {
  return {
    esportsGameId: `g${number}`,
    number,
    teamOutcomes: [
      { esportsTeamId: winner, outcome: "WIN" },
      { esportsTeamId: loser, outcome: "LOSS" },
    ],
  };
}

function detail(overrides: Record<string, unknown> = {}) {
  return {
    id: "117000000000000001",
    updatedAt: "2026-10-18T20:00:00Z",
    config: {
      structure: "SWISS",
      matchFormat: "BO3",
      roundCount: 2,
      playerFormat: "ONE_V_ONE",
    },
    tournamentParticipants: [
      participant("t1", "u1", "Teemo Main"),
      participant("t2", "u2", "Poro Snax"),
      participant("t3", "u3", "Yordle Squad", "DROPPED"),
    ],
    stages: [
      {
        esportsStageId: "s1",
        name: "",
        sections: [
          {
            esportsSectionId: "x1",
            rounds: [
              {
                roundNumber: 1,
                status: "FINALIZED",
                byeTeamIds: ["t3"],
                matches: [
                  {
                    esportsMatchId: "m1",
                    tableNumber: 1,
                    status: "IN_PROGRESS",
                    teamOutcomes: [
                      { esportsTeamId: "t1", outcome: "WIN" },
                      { esportsTeamId: "t2", outcome: "LOSS" },
                    ],
                    games: [game(1, "t1", "t2"), game(2, "t2", "t1"), game(3, "t1", "t2")],
                    teams: [{ esportsTeamId: "t1" }, { esportsTeamId: "t2" }],
                  },
                ],
                endOfRoundStandings: [standing("t1", 1, 1, 0), standing("t2", 3, 0, 1)],
              },
              {
                roundNumber: 2,
                status: "FINALIZED",
                byeTeamIds: [],
                matches: [
                  {
                    esportsMatchId: "m2",
                    tableNumber: 1,
                    status: "IN_PROGRESS",
                    teamOutcomes: [
                      { esportsTeamId: "t2", outcome: "TIE" },
                      { esportsTeamId: "t3", outcome: "TIE" },
                    ],
                    games: [],
                    teams: [{ esportsTeamId: "t2" }, { esportsTeamId: "t3" }],
                  },
                  {
                    esportsMatchId: "m3",
                    tableNumber: 2,
                    status: "UNSTARTED",
                    teamOutcomes: [],
                    games: [],
                    teams: [{ esportsTeamId: "t1" }, { esportsTeamId: "t9" }],
                  },
                ],
                endOfRoundStandings: [
                  standing("t1", 1, 2, 0),
                  standing("t3", 2, 1, 0),
                  standing("t2", 3, 0, 1),
                ],
              },
            ],
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe("projectTournamentDetail", () => {
  it("ranks players by the last round's standings and marks drops", () => {
    const projected = projectTournamentDetail(detail());
    expect(projected?.standings).toEqual([
      {
        teamId: "t1",
        playerId: "u1",
        playerName: "Teemo Main",
        rank: 1,
        wins: 2,
        losses: 0,
        draws: 0,
        matchPoints: 6,
        opponentMatchWinPct: 0.4444444444444444,
        gameWinPct: 0.5,
        opponentGameWinPct: 0.5,
        entryStatus: null,
      },
      expect.objectContaining({ teamId: "t2", rank: 3, entryStatus: null }),
      expect.objectContaining({ teamId: "t3", rank: 2, entryStatus: "dropped" }),
    ]);
  });

  it("mirrors played matches, byes and draws, and skips unplayed pairings", () => {
    const matches = projectTournamentDetail(detail())?.matches ?? [];
    expect(matches).toEqual([
      {
        sourceMatchId: "m1",
        roundId: "s1:x1:1",
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
      },
      expect.objectContaining({
        sourceMatchId: "bye:s1:x1:1:t3",
        isBye: true,
        player1TeamId: "t3",
        player2TeamId: null,
        winnerTeamId: "t3",
      }),
      expect.objectContaining({
        sourceMatchId: "m2",
        isDraw: true,
        winnerTeamId: null,
        gamesWonP1: null,
      }),
    ]);
  });

  it("files one phase per stage and reports round progress", () => {
    const projected = projectTournamentDetail(detail());
    expect(projected?.phases).toEqual([
      {
        phaseOrder: 0,
        name: null,
        roundType: "SWISS",
        roundCount: 2,
        maxGameWins: 2,
        roundsPlayed: 2,
      },
    ]);
    expect(projected?.facts).toEqual({
      structure: "SWISS",
      matchFormat: "BO3",
      roundCount: 2,
      roundsPlayed: 2,
      roundsFinalized: 2,
      sourceUpdatedAt: new Date("2026-10-18T20:00:00Z"),
    });
  });

  it("keeps every player's latest standing when a top-cut round lists only the cut", () => {
    const base = detail();
    const topCut = {
      esportsStageId: "s2",
      name: "Top Cut",
      sections: [
        {
          esportsSectionId: "x2",
          rounds: [
            {
              roundNumber: 1,
              status: "FINALIZED",
              byeTeamIds: [],
              matches: [],
              endOfRoundStandings: [standing("t3", 1, 2, 0), standing("t1", 2, 2, 1)],
            },
          ],
        },
      ],
    };
    const projected = projectTournamentDetail({ ...base, stages: [...base.stages, topCut] });
    const ranks = Object.fromEntries(
      (projected?.standings ?? []).map((row) => [row.teamId, row.rank]),
    );
    expect(ranks).toEqual({ t1: 2, t2: 3, t3: 1 });
  });

  it("keeps the semifinal losers' places when the final round lists only the finalists", () => {
    const base = detail();
    const cutRound = (roundNumber: number, rows: Record<string, unknown>[]) => ({
      roundNumber,
      status: "FINALIZED",
      byeTeamIds: [],
      matches: [],
      endOfRoundStandings: rows,
    });
    const topCut = {
      esportsStageId: "s2",
      sections: [
        {
          esportsSectionId: "x2",
          rounds: [
            cutRound(1, [
              standing("t1", 3, 2, 1),
              standing("t3", 1, 2, 0),
              standing("t2", 2, 1, 1),
            ]),
            cutRound(2, [standing("t3", 1, 3, 0), standing("t2", 2, 1, 2)]),
          ],
        },
      ],
    };
    const projected = projectTournamentDetail({ ...base, stages: [...base.stages, topCut] });
    const ranks = Object.fromEntries(
      (projected?.standings ?? []).map((row) => [row.teamId, row.rank]),
    );
    expect(ranks).toEqual({ t1: 3, t2: 2, t3: 1 });
  });

  it("stores only the game name of a Riot ID", () => {
    const projected = projectTournamentDetail(
      detail({
        tournamentParticipants: [
          {
            esportsTeamId: "t1",
            status: "ACTIVE",
            player: { id: "u1", displayName: "Teemo Main#EUW", tagLine: "EUW" },
          },
        ],
        stages: [],
      }),
    );
    expect(projected?.standings[0]?.playerName).toBe("Teemo Main");
    expect(JSON.stringify(projected)).not.toContain("EUW");
  });

  it("takes the latest round's standings even when the payload lists rounds newest first", () => {
    const base = detail();
    const [stage] = base.stages;
    const section = stage?.sections[0];
    const projected = projectTournamentDetail({
      ...base,
      stages: [{ ...stage, sections: [{ ...section, rounds: section?.rounds.toReversed() }] }],
    });
    const t1 = projected?.standings.find((row) => row.teamId === "t1");
    expect(t1).toMatchObject({ rank: 1, wins: 2 });
  });

  it("names a top-cut stage so the archive reads it as elimination", () => {
    const base = detail();
    const projected = projectTournamentDetail({
      ...base,
      config: { ...base.config, structure: "SWISS_PLUS_SINGLE_ELIM" },
      stages: [...base.stages, { esportsStageId: "s2", name: "Top Cut", sections: [] }],
    });
    expect(projected?.phases.map((phase) => phase.roundType)).toEqual([
      "SWISS",
      "SINGLE_ELIMINATION",
    ]);
  });

  it("joins a team's players into one row with no player id", () => {
    const projected = projectTournamentDetail(
      detail({
        tournamentParticipants: [
          participant("t1", "u1", "Teemo Main"),
          participant("t1", "u2", "Poro Snax"),
        ],
        stages: [],
      }),
    );
    expect(projected?.standings).toEqual([
      expect.objectContaining({
        teamId: "t1",
        playerId: null,
        playerName: "Teemo Main / Poro Snax",
      }),
    ]);
  });

  it("files a one-seat pairing as a bye, once, even when the round lists that bye too", () => {
    const projected = projectTournamentDetail(
      detail({
        stages: [
          {
            esportsStageId: "s1",
            sections: [
              {
                esportsSectionId: "x1",
                rounds: [
                  {
                    roundNumber: 1,
                    status: "FINALIZED",
                    byeTeamIds: ["t3"],
                    matches: [
                      {
                        esportsMatchId: "m9",
                        teamOutcomes: [{ esportsTeamId: "t3", outcome: "WIN" }],
                        games: [],
                        teams: [{ esportsTeamId: "t3" }],
                      },
                    ],
                    endOfRoundStandings: [],
                  },
                ],
              },
            ],
          },
        ],
      }),
    );
    expect(projected?.matches).toEqual([
      expect.objectContaining({
        sourceMatchId: "m9",
        isBye: true,
        isDraw: false,
        player1TeamId: "t3",
        player2TeamId: null,
        winnerTeamId: "t3",
      }),
    ]);
  });

  it("returns null for a missing tournament", () => {
    expect(projectTournamentDetail(undefined)).toBeNull();
  });
});

describe("phasesToStore", () => {
  const phase = {
    phaseOrder: 0,
    name: null,
    roundType: "SWISS",
    roundCount: 5,
    maxGameWins: 2,
    roundsPlayed: 3,
  };

  it("keeps the planned rounds while the event runs", () => {
    expect(phasesToStore([phase], false)).toEqual([
      { phaseOrder: 0, name: null, roundType: "SWISS", roundCount: 5, maxGameWins: 2 },
    ]);
  });

  it("stores the rounds a finished event played", () => {
    expect(phasesToStore([phase], true)[0]?.roundCount).toBe(3);
    expect(phasesToStore([{ ...phase, roundsPlayed: 0 }], true)[0]?.roundCount).toBe(5);
  });
});

describe("playriftboundDisplayStatus", () => {
  const start = new Date("2026-10-18T15:00:00Z");
  const facts = {
    structure: "SWISS",
    roundCount: 4,
    roundsPlayed: 3,
    roundsFinalized: 3,
    sourceUpdatedAt: new Date("2026-10-18T19:00:00Z"),
  };

  it("is upcoming before the start", () => {
    expect(playriftboundDisplayStatus(facts, start, new Date("2026-10-18T14:00:00Z"))).toBe(
      "upcoming",
    );
  });

  it("stays in progress while a short, finalized event is still recent", () => {
    expect(playriftboundDisplayStatus(facts, start, new Date("2026-10-18T20:00:00Z"))).toBe(
      "inProgress",
    );
  });

  it("completes a short event once it has been quiet for hours", () => {
    expect(playriftboundDisplayStatus(facts, start, new Date("2026-10-19T02:00:00Z"))).toBe(
      "complete",
    );
  });

  it("completes as soon as the planned rounds are finalized", () => {
    expect(
      playriftboundDisplayStatus(
        { ...facts, roundsPlayed: 4, roundsFinalized: 4 },
        start,
        new Date("2026-10-18T20:00:00Z"),
      ),
    ).toBe("complete");
  });

  it("waits for a top-cut event to go quiet, since its planned rounds may be Swiss only", () => {
    const swissDone = {
      ...facts,
      structure: "SWISS_PLUS_SINGLE_ELIM",
      roundsPlayed: 4,
      roundsFinalized: 4,
    };
    expect(playriftboundDisplayStatus(swissDone, start, new Date("2026-10-18T20:00:00Z"))).toBe(
      "inProgress",
    );
    expect(playriftboundDisplayStatus(swissDone, start, new Date("2026-10-19T02:00:00Z"))).toBe(
      "complete",
    );
  });

  it("keeps an open round in progress, until the event is days old", () => {
    const open = { ...facts, roundsFinalized: 2 };
    expect(playriftboundDisplayStatus(open, start, new Date("2026-10-19T12:00:00Z"))).toBe(
      "inProgress",
    );
    expect(playriftboundDisplayStatus(open, start, new Date("2026-10-21T15:00:00Z"))).toBe(
      "complete",
    );
  });
});

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(a));
}

describe("search cells", () => {
  it("puts every point within one search radius of its cell's centre", () => {
    for (let lat = -56; lat <= 72; lat += 0.73) {
      for (let lng = -180; lng < 180; lng += 1.37) {
        const cell = cellOf(lat, lng);
        expect(distanceMeters(lat, lng, cell.latitude, cell.longitude)).toBeLessThan(
          SEARCH_RADIUS_METERS,
        );
      }
    }
  });

  it("lists each cell once, with the same key cellOf gives its centre", () => {
    const cells = cellsBetween(-56, 72);
    expect(new Set(cells.map((cell) => cell.key)).size).toBe(cells.length);
    for (const cell of cells.slice(0, 500)) {
      expect(cellOf(cell.latitude, cell.longitude).key).toBe(cell.key);
    }
  });
});

describe("source vocabulary", () => {
  it("files constructed as constructed and everything else as freeform", () => {
    expect(playriftboundFormat("CONSTRUCTED")).toBe("constructed");
    expect(playriftboundFormat("LIMITED_SEALED")).toBe("freeform");
    expect(playriftboundFormat(null)).toBe("freeform");
  });

  it("treats anything but 1v1 as a team format", () => {
    expect(isTeamFormat("ONE_V_ONE")).toBe(false);
    expect(isTeamFormat("TWO_V_TWO")).toBe(true);
    expect(isTeamFormat(null)).toBe(false);
  });
});
