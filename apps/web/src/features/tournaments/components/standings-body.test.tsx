import type { PodRoundResponse, PodStandingRow } from "@openrift/shared/types/api/pod-tournament";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StandingsBody } from "./standings-body";

vi.mock("@/features/tournaments/hooks/use-region-label", () => ({
  useRegionLabel: () => (slug: string) => slug.toUpperCase(),
}));

function makeRow(playerId: string, score: number): PodStandingRow {
  return {
    playerId,
    displayName: `Player ${playerId}`,
    image: null,
    gravatarHash: null,
    status: "active",
    droppedAfterRound: null,
    teamId: null,
    score,
    gamePoints: 0,
    roundsPlayed: 1,
    pods3Count: 0,
    pods4Count: 0,
    byeCount: 0,
    podWins: 0,
    wins: score > 0 ? 1 : 0,
    draws: 0,
    losses: score > 0 ? 0 : 1,
    region: "noxus",
    avgOpponentScore: 0,
    avgOpponentGamePoints: 0,
  };
}

const ROUND: PodRoundResponse = {
  id: "r1",
  roundNumber: 1,
  status: "finalized",
  pairingStrategy: "swiss",
  penaltyTotal: null,
  createdAt: "2026-09-09T10:00:00Z",
  finalizedAt: null,
  byes: [],
  pods: [
    {
      id: "p1",
      podNumber: 1,
      size: 2,
      resultStatus: "reported",
      drawnGames: 0,
      penalty: null,
      members: [
        {
          playerId: "a",
          displayName: "Player a",
          image: null,
          gravatarHash: null,
          teamId: null,
          gamePoints: 2,
          placement: 1,
          points: 3,
        },
        {
          playerId: "b",
          displayName: "Player b",
          image: null,
          gravatarHash: null,
          teamId: null,
          gamePoints: 0,
          placement: 2,
          points: 0,
        },
      ],
    },
  ],
};

describe("StandingsBody", () => {
  it("gives every standings page the Run column and the region overview", () => {
    render(
      <StandingsBody
        format="rounds"
        cutSize={8}
        legendTiebreak={false}
        pairingStyle="swiss"
        playMode="1v1"
        regionsEnabled
        standings={[makeRow("a", 3), makeRow("b", 0)]}
        rounds={[ROUND]}
        groupStage={null}
        legendCardByPlayer={new Map()}
        live={false}
        completed={false}
      />,
    );
    expect(screen.getByRole("columnheader", { name: "Run" })).toBeInTheDocument();
    expect(screen.getByText("Regions")).toBeInTheDocument();
  });

  it("keeps the group cut view before the groups are drawn", () => {
    render(
      <StandingsBody
        format="group_cut"
        cutSize={8}
        legendTiebreak={false}
        pairingStyle="swiss"
        playMode="1v1"
        regionsEnabled={false}
        standings={[makeRow("a", 0), makeRow("b", 0)]}
        rounds={[]}
        groupStage={{
          groups: [],
          ranking: [],
          pendingMetaShares: [],
          stageComplete: false,
          cutGenerated: false,
          seedsDiverged: false,
          finalStandings: null,
        }}
        legendCardByPlayer={new Map()}
        live
        completed={false}
      />,
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
