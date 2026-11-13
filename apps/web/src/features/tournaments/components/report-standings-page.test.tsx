import type { PodReportResponse, PodStandingRow } from "@openrift/shared/types/api/pod-tournament";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { ReportStandingsPage } from "./report-standings-page";

const { report } = vi.hoisted(() => ({ report: { current: null as unknown } }));

vi.mock("@/hooks/use-hydrated", () => ({ useHydrated: () => false }));
vi.mock("@/features/tournaments/hooks/use-region-label", () => ({
  useRegionLabel: () => (slug: string) => slug,
}));
vi.mock("@/features/tournaments/hooks/use-tournament-run", () => ({
  useReportStandingsSnapshot: vi.fn(),
}));
vi.mock("@/features/tournaments/components/tournament-shell", () => ({
  TournamentReportFrame: ({ render: renderBody }: { render: (data: unknown) => ReactNode }) =>
    renderBody(report.current),
}));
vi.mock("@tanstack/react-router", () => ({
  getRouteApi: () => ({ useParams: () => ({ token: "t" }), useSearch: () => ({}) }),
  useNavigate: () => vi.fn(),
}));

function standing(playerId: string, score: number): PodStandingRow {
  return {
    playerId,
    displayName: playerId,
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
    wins: 0,
    draws: 0,
    losses: 0,
    region: null,
    avgOpponentScore: 0,
    avgOpponentGamePoints: 0,
  };
}

describe("ReportStandingsPage", () => {
  it("shows the Legend column on a Swiss event, as the staff standings do", () => {
    report.current = {
      tournamentName: "Summoner Skirmish",
      status: "running",
      startsAt: "2026-11-13T18:00:00Z",
      endsAt: null,
      currentRound: 1,
      pairingStyle: "swiss",
      playMode: "1v1",
      scoringScheme: "standard",
      byePoints: 3,
      matchFormat: "bo1",
      winPoints: 3,
      drawPoints: 1,
      regionsEnabled: false,
      format: "rounds",
      cutSize: 8,
      legendTiebreak: false,
      groupsSelfPaced: false,
      standings: [standing("Ashe", 3), standing("Braum", 0)],
      rounds: [],
      groupStage: null,
      playerLegends: [{ playerId: "Ashe", legendCardId: "jinx" }],
      canSubmit: false,
    } satisfies PodReportResponse;

    render(<ReportStandingsPage />);

    expect(screen.getByRole("columnheader", { name: "Legend" })).toBeInTheDocument();
  });
});
