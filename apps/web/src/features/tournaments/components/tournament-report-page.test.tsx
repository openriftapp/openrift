import type {
  GroupStageView,
  PodReportResponse,
  PodResponse,
  PodRoundResponse,
} from "@openrift/shared/types/api/pod-tournament";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ReportRoundsContent } from "./tournament-report-page";

const { submitResultMutateAsync, submitPlayerMutateAsync } = vi.hoisted(() => ({
  submitResultMutateAsync: vi.fn((): Promise<unknown> => Promise.resolve()),
  submitPlayerMutateAsync: vi.fn((): Promise<unknown> => Promise.resolve()),
}));

vi.mock("@/hooks/use-hydrated", () => ({ useHydrated: () => false }));
vi.mock("@/features/tournaments/hooks/use-tournament-run", () => ({
  useStartReportGroupRound: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSubmitTournamentReportPlayerResult: () => ({
    mutateAsync: submitPlayerMutateAsync,
    isPending: false,
  }),
  useSubmitTournamentReportResult: () => ({
    mutateAsync: submitResultMutateAsync,
    isPending: false,
  }),
}));

function pod(id: string, players: [string, number][]): PodResponse {
  return {
    id,
    podNumber: 1,
    size: 2,
    resultStatus: "reported",
    members: players.map(([playerId, gamePoints], index) => ({
      playerId,
      displayName: playerId,
      image: null,
      gravatarHash: null,
      teamId: null,
      gamePoints,
      placement: index + 1,
      points: index === 0 ? 3 : 0,
    })),
    penalty: null,
  };
}

function round(roundNumber: number, status: PodRoundResponse["status"]): PodRoundResponse {
  return {
    id: `r-${roundNumber}`,
    roundNumber,
    status,
    pairingStrategy: "swiss",
    penaltyTotal: null,
    createdAt: "2026-09-09T10:00:00Z",
    finalizedAt: null,
    pods: [
      pod(`pod-${roundNumber}`, [
        ["Ashe", 2],
        ["Garen", 0],
      ]),
    ],
    byes: [],
  };
}

const groupStage: GroupStageView = {
  groups: [
    {
      id: "g-A",
      label: "A",
      pairedGroupId: null,
      pairedGroupLabel: null,
      playerIds: ["Ashe", "Garen"],
      roundsStarted: 1,
      currentRoundReported: true,
      canStartNextRound: false,
      done: false,
      standings: [],
    },
  ],
  ranking: [],
  pendingMetaShares: [],
  stageComplete: false,
  cutGenerated: false,
  seedsDiverged: false,
  finalStandings: null,
};

function report(
  status: PodReportResponse["status"],
  roundStatus: PodRoundResponse["status"],
): PodReportResponse {
  return {
    tournamentName: "Summoner Skirmish",
    status,
    currentRound: 1,
    pairingStyle: "swiss",
    playMode: "1v1",
    scoringScheme: "standard",
    byePoints: 3,
    matchFormat: "bo3",
    winPoints: 3,
    drawPoints: 1,
    regionsEnabled: false,
    format: "group_cut",
    cutSize: 4,
    legendTiebreak: false,
    groupsSelfPaced: false,
    standings: [],
    rounds: [round(1, roundStatus)],
    groupStage,
    canSubmit: true,
  };
}

describe("ReportRoundsContent", () => {
  it("asks for games won and offers edits while a round is open", () => {
    render(<ReportRoundsContent token="t" data={report("running", "reporting")} />);
    expect(screen.getByText(/Enter your games won/u)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit result" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Edit score/u })).toHaveLength(2);
  });

  it("hides the hint and every edit control once the event is completed", () => {
    render(<ReportRoundsContent token="t" data={report("completed", "reporting")} />);
    expect(screen.queryByText(/Enter your games won/u)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit result" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Edit score/u })).not.toBeInTheDocument();
  });
});

describe("ReportRoundsContent failed submissions", () => {
  beforeEach(() => {
    submitResultMutateAsync.mockReset();
    submitResultMutateAsync.mockResolvedValue(undefined);
    submitPlayerMutateAsync.mockReset();
    submitPlayerMutateAsync.mockResolvedValue(undefined);
  });

  it("keeps the result form open when the submission is rejected", async () => {
    submitResultMutateAsync.mockRejectedValueOnce(new Error("offline"));
    const user = userEvent.setup();
    render(<ReportRoundsContent token="t" data={report("running", "reporting")} />);

    await user.click(screen.getByRole("button", { name: "Edit result" }));
    await user.click(screen.getAllByRole("button", { name: /wins/u })[0]!);
    await user.click(screen.getByRole("button", { name: "Save result" }));

    expect(submitResultMutateAsync).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Save result" })).toBeInTheDocument();
  });

  it("closes the result form after the submission is saved", async () => {
    const user = userEvent.setup();
    render(<ReportRoundsContent token="t" data={report("running", "reporting")} />);

    await user.click(screen.getByRole("button", { name: "Edit result" }));
    await user.click(screen.getAllByRole("button", { name: /wins/u })[0]!);
    await user.click(screen.getByRole("button", { name: "Save result" }));

    expect(screen.queryByRole("button", { name: "Save result" })).not.toBeInTheDocument();
  });
});
