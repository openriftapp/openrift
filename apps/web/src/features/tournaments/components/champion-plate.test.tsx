import type {
  PodStandingRow,
  PodTournamentDetailResponse,
} from "@openrift/shared/types/api/pod-tournament";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ChampionPlate, tournamentChampion } from "./champion-plate";

vi.mock("@/hooks/use-hydrated", () => ({ useHydrated: () => true }));
vi.mock("@/hooks/use-domain-colors", () => ({ useDomainColors: () => ({}) }));
vi.mock("@/features/decks/components/domain-icon", () => ({
  DomainIcon: ({ domain }: { domain: string }) => <span>{domain}</span>,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children?: React.ReactNode }) => <a href="/">{children}</a>,
}));
vi.mock("@/features/cards/hooks/use-cards", () => ({
  useCards: () => ({
    printingsByCardId: new Map([
      [
        "legend-1",
        [
          {
            images: [{ face: "front", imageId: "img-1" }],
            card: {
              name: "Loose Cannon",
              types: ["legend"],
              tags: ["Jinx"],
              slug: "jinx",
              domains: ["fury"],
            },
          },
        ],
      ],
    ]),
  }),
}));

function standing(playerId: string, score: number, wins: number): PodStandingRow {
  return {
    playerId,
    displayName: `Player ${playerId}`,
    status: "active",
    droppedAfterRound: null,
    teamId: null,
    score,
    gamePoints: score,
    roundsPlayed: 3,
    pods3Count: 0,
    pods4Count: 0,
    byeCount: 0,
    podWins: wins,
    wins,
    draws: 0,
    losses: 3 - wins,
    region: null,
    avgOpponentScore: 0,
    avgOpponentGamePoints: 0,
  };
}

function run(overrides: Partial<PodTournamentDetailResponse> = {}): PodTournamentDetailResponse {
  return {
    tournament: {
      id: "t-1",
      name: "Summoner Skirmish",
      status: "completed",
      currentRound: 3,
      pairingStyle: "swiss",
      playMode: "1v1",
      scoringScheme: "standard",
      byePoints: 3,
      matchFormat: "bo3",
      winPoints: 3,
      drawPoints: 1,
      regionsEnabled: false,
      format: "rounds",
      cutSize: 8,
      cutRematchAvoidance: false,
      legendTiebreak: false,
      groupsSelfPaced: true,
      reportToken: null,
      createdAt: "2026-07-01T10:00:00Z",
      updatedAt: "2026-07-01T10:00:00Z",
    },
    players: [
      {
        id: "p1",
        displayName: "Player p1",
        status: "active",
        droppedAfterRound: null,
        teamId: null,
        legendCardId: "legend-1",
        createdAt: "2026-07-01T10:00:00Z",
      },
    ],
    standings: [standing("p1", 9, 3), standing("p2", 6, 2)],
    rounds: [],
    openRoundSnapshot: null,
    groupStage: null,
    legendMetaShares: [],
    ...overrides,
  };
}

describe("tournamentChampion", () => {
  it("takes the sole points leader with their record and legend", () => {
    expect(tournamentChampion(run(), true)).toEqual({
      playerId: "p1",
      displayName: "Player p1",
      record: "3-0-0",
      legendCardId: "legend-1",
    });
  });

  it("names nobody while the top is shared", () => {
    const tied = run({ standings: [standing("p1", 9, 3), standing("p2", 9, 3)] });
    expect(tournamentChampion(tied, true)).toBeNull();
  });

  it("prefers the final standings of a cut over the points table", () => {
    const cut = run({
      standings: [standing("p2", 12, 4), standing("p1", 9, 3)],
      groupStage: {
        groups: [],
        ranking: [],
        pendingMetaShares: [],
        stageComplete: true,
        cutGenerated: true,
        seedsDiverged: false,
        finalStandings: [
          {
            playerId: "p1",
            displayName: "Player p1",
            place: 1,
            seed: 3,
            groupLabel: "A",
            groupPlace: 1,
            exitRound: null,
          },
        ],
      },
    });
    expect(tournamentChampion(cut, true)?.playerId).toBe("p1");
  });
});

describe("ChampionPlate", () => {
  it("shows the champion with their legend and record", () => {
    render(<ChampionPlate run={run()} swiss />);
    expect(screen.getByText("Champion")).toBeInTheDocument();
    expect(screen.getByText("Player p1")).toBeInTheDocument();
    expect(screen.getByText("Jinx")).toBeInTheDocument();
    expect(screen.getByText("Loose Cannon")).toBeInTheDocument();
    expect(screen.getByText("3-0-0")).toBeInTheDocument();
  });

  it("renders nothing without a champion", () => {
    const { container } = render(
      <ChampionPlate
        run={run({ standings: [standing("p1", 9, 3), standing("p2", 9, 3)] })}
        swiss
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
