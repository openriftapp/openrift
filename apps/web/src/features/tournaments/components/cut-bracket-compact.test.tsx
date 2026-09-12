import type {
  GroupStageView,
  PodResponse,
  PodRoundResponse,
} from "@openrift/shared/types/api/pod-tournament";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CutBracketCompact } from "./cut-bracket-compact";

vi.mock("@/hooks/use-hydrated", () => ({ useHydrated: () => false }));

function pod(
  id: string,
  podNumber: number,
  seats: [string, number | null, number | null][],
): PodResponse {
  return {
    id,
    podNumber,
    size: 2,
    resultStatus: seats.every((seat) => seat[2] !== null) ? "reported" : "pending",
    members: seats.map(([playerId, gamePoints, placement]) => ({
      playerId,
      displayName: playerId,
      teamId: null,
      gamePoints,
      placement,
      points: null,
    })),
    penalty: null,
  };
}

function round(roundNumber: number, pods: PodResponse[]): PodRoundResponse {
  return {
    id: `r-${roundNumber}`,
    roundNumber,
    status: "finalized",
    pairingStrategy: "cut",
    penaltyTotal: null,
    createdAt: "2026-09-09T10:00:00Z",
    finalizedAt: null,
    pods,
    byes: [],
  };
}

const stage: GroupStageView = {
  groups: [
    {
      id: "g-A",
      label: "A",
      pairedGroupId: null,
      pairedGroupLabel: null,
      playerIds: ["Ashe", "Garen", "Jinx", "Sett"],
      roundsStarted: 3,
      currentRoundReported: true,
      canStartNextRound: false,
      done: true,
      standings: [
        {
          playerId: "Ashe",
          displayName: "Ashe",
          status: "active",
          legendCardId: "c1",
          legendName: "Ashe, Frost Archer",
          place: 1,
          points: 9,
          wins: 3,
          losses: 0,
          draws: 0,
          gamesWon: 6,
          gamesPlayed: 6,
          gameWinRate: 1,
          decidedBy: null,
        },
      ],
    },
  ],
  ranking: ["Ashe", "Garen", "Jinx", "Sett"].map((playerId, index) => ({
    playerId,
    displayName: playerId,
    groupLabel: "A",
    place: index + 1,
    matchWinRate: 1 - index * 0.25,
    gameWinRate: null,
    legendCount: null,
    metaShare: null,
    decidedBy: null,
    seed: index + 1,
    qualified: true,
  })),
  pendingMetaShares: [],
  stageComplete: true,
  cutGenerated: true,
  seedsDiverged: false,
  finalStandings: null,
};

describe("CutBracketCompact", () => {
  it("shows one column per cut round with seeds, legends and scores", () => {
    render(
      <CutBracketCompact
        cutSize={4}
        groupStage={stage}
        rounds={[
          round(4, [
            pod("p1", 1, [
              ["Ashe", 2, 1],
              ["Sett", 0, 2],
            ]),
            pod("p2", 2, [
              ["Garen", 1, 2],
              ["Jinx", 2, 1],
            ]),
          ]),
          round(5, [
            pod("p3", 1, [
              ["Ashe", null, null],
              ["Jinx", null, null],
            ]),
          ]),
        ]}
      />,
    );
    expect(screen.getByText("Top 4")).toBeInTheDocument();
    expect(screen.getByText("Semifinals")).toBeInTheDocument();
    expect(screen.getAllByText("Final")).toHaveLength(2);
    expect(screen.getByText("#4")).toBeInTheDocument();
    expect(screen.getByText("SF 1")).toBeInTheDocument();
    expect(screen.getAllByText("Table 1")).toHaveLength(2);
    expect(screen.getAllByText("A")).toHaveLength(6);
    expect(screen.getAllByText("chooses starter")).toHaveLength(1);
    // The seat shows the champion only: Ashe twice as a player, twice as her Legend.
    expect(screen.getAllByText("Ashe")).toHaveLength(4);
    expect(screen.getAllByText("–")).toHaveLength(2);
  });

  it("swaps the seed for a medal once the final standings exist", () => {
    render(
      <CutBracketCompact
        cutSize={4}
        groupStage={{
          ...stage,
          finalStandings: [
            {
              playerId: "Ashe",
              displayName: "Ashe",
              place: 1,
              seed: 1,
              groupLabel: "A",
              groupPlace: 1,
              exitRound: null,
            },
          ],
        }}
        rounds={[
          round(5, [
            pod("p3", 1, [
              ["Ashe", 2, 1],
              ["Jinx", 0, 2],
            ]),
          ]),
        ]}
      />,
    );
    expect(screen.queryByText("#1")).not.toBeInTheDocument();
    expect(screen.getByText("#3")).toBeInTheDocument();
  });

  it("renders nothing before the cut is generated", () => {
    const { container } = render(
      <CutBracketCompact cutSize={4} groupStage={{ ...stage, cutGenerated: false }} rounds={[]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
