import type {
  GroupStageView,
  PodResponse,
  PodTournamentDetailResponse,
} from "@openrift/shared/types/api/pod-tournament";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PodPairingsSection } from "./pairings-section";

const idleMutation = { mutateAsync: vi.fn(), isPending: false };

vi.mock("@/features/tournaments/hooks/use-tournament-run", () => ({
  useClearTournamentResult: () => idleMutation,
  useFinalizeTournamentRound: () => idleMutation,
  useGenerateTournamentRound: () => idleMutation,
  useRerollTournamentRound: () => idleMutation,
  useSubmitTournamentResult: () => idleMutation,
  useStartGroupRound: () => idleMutation,
  useStartGroupStageRound: () => idleMutation,
}));

vi.mock("./generate-round-controls", () => ({
  GenerateRoundControls: () => <div>Round generator</div>,
}));

vi.mock("./group-generate-band", () => ({
  GenerateGroupsBand: () => <div>Group draw</div>,
}));

vi.mock("./pod-pairing-editor", () => ({
  PodPairingEditor: ({ onClose }: { onClose: () => void }) => (
    <button type="button" onClick={onClose}>
      Close pairing editor
    </button>
  ),
}));

vi.mock("./group-seat-editor", () => ({
  GroupSeatEditor: ({ onClose }: { onClose: () => void }) => (
    <button type="button" onClick={onClose}>
      Close group editor
    </button>
  ),
}));

function member(playerId: string): PodResponse["members"][number] {
  return {
    playerId,
    displayName: `Player ${playerId}`,
    image: null,
    gravatarHash: null,
    teamId: null,
    gamePoints: null,
    placement: null,
    points: null,
  };
}

function runState(
  overrides: Partial<PodTournamentDetailResponse> = {},
): PodTournamentDetailResponse {
  return {
    tournament: {
      id: "t-1",
      name: "Summoner Skirmish",
      status: "running",
      currentRound: 1,
      pairingStyle: "pod",
      playMode: "1v1",
      scoringScheme: "standard",
      byePoints: 3,
      matchFormat: "bo1",
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
    players: [],
    standings: [],
    rounds: [
      {
        id: "r-1",
        roundNumber: 1,
        status: "reporting",
        pairingStrategy: "pod",
        penaltyTotal: 0,
        createdAt: "2026-07-01T10:00:00Z",
        finalizedAt: null,
        pods: [
          {
            id: "pod-1",
            podNumber: 1,
            size: 4,
            resultStatus: "pending",
            drawnGames: 0,
            members: ["p1", "p2", "p3", "p4"].map((playerId) => member(playerId)),
            penalty: null,
          },
        ],
        byes: [],
      },
    ],
    openRoundSnapshot: null,
    groupStage: null,
    legendMetaShares: [],
    ...overrides,
  };
}

function drawnGroupStage(): GroupStageView {
  return {
    groups: [
      {
        id: "g-A",
        label: "A",
        pairedGroupId: null,
        pairedGroupLabel: null,
        playerIds: ["p1", "p2", "p3", "p4"],
        roundsStarted: 1,
        currentRoundReported: false,
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
}

const ROUND_CONTROLS = ["Finalize round", "Edit pairing", "Re-roll", "Enter result"];

describe("PodPairingsSection", () => {
  it("gives a host or organizer the round controls", () => {
    render(<PodPairingsSection id="t-1" data={runState()} staff manage />);
    for (const name of ROUND_CONTROLS) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("shows a participant the round without its controls", () => {
    render(<PodPairingsSection id="t-1" data={runState()} staff={false} manage={false} />);
    expect(screen.getByText("Player p1")).toBeInTheDocument();
    for (const name of ROUND_CONTROLS) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
  });

  it("keeps the round controls from a judge, whom the API refuses them", () => {
    render(<PodPairingsSection id="t-1" data={runState()} staff manage={false} />);
    for (const name of ROUND_CONTROLS) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
  });

  it("offers the next round only to a host or organizer", () => {
    const between = runState({ rounds: [] });
    const { unmount } = render(<PodPairingsSection id="t-1" data={between} staff manage />);
    expect(screen.getByText("Round generator")).toBeInTheDocument();
    unmount();

    render(<PodPairingsSection id="t-1" data={between} staff={false} manage={false} />);
    expect(screen.queryByText("Round generator")).not.toBeInTheDocument();
  });

  it("tells a judge in a group cut that the groups are not drawn yet", () => {
    const groupCut = runState({ rounds: [] });
    groupCut.tournament.format = "group_cut";
    const { unmount } = render(<PodPairingsSection id="t-1" data={groupCut} staff manage />);
    expect(screen.getByText("Group draw")).toBeInTheDocument();
    unmount();

    render(<PodPairingsSection id="t-1" data={groupCut} staff manage={false} />);
    expect(screen.getByText("The groups have not been drawn yet.")).toBeInTheDocument();
    expect(screen.queryByText("Group draw")).not.toBeInTheDocument();
  });

  it("returns the focus to Edit pairing when the pairing editor closes", () => {
    render(
      <PodPairingsSection
        id="t-1"
        data={runState({ openRoundSnapshot: [] as never })}
        staff
        manage
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit pairing" }));
    fireEvent.click(screen.getByRole("button", { name: "Close pairing editor" }));

    expect(screen.getByRole("button", { name: "Edit pairing" })).toHaveFocus();
  });

  it("leaves the focus alone when Edit pairing comes back long after the editor closed", () => {
    const data = runState({ openRoundSnapshot: [] as never });
    const { rerender } = render(<PodPairingsSection id="t-1" data={data} staff manage />);
    fireEvent.click(screen.getByRole("button", { name: "Edit pairing" }));
    rerender(<PodPairingsSection id="t-1" data={data} staff manage={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Close pairing editor" }));
    expect(screen.queryByRole("button", { name: "Edit pairing" })).not.toBeInTheDocument();

    rerender(<PodPairingsSection id="t-1" data={data} staff manage />);

    expect(screen.getByRole("button", { name: "Edit pairing" })).not.toHaveFocus();
  });

  it("returns the focus to Edit groups when the group editor closes", () => {
    const groupCut = runState({ groupStage: drawnGroupStage() });
    groupCut.tournament.format = "group_cut";
    render(<PodPairingsSection id="t-1" data={groupCut} staff manage />);
    fireEvent.click(screen.getByRole("button", { name: "Edit groups" }));
    fireEvent.click(screen.getByRole("button", { name: "Close group editor" }));

    expect(screen.getByRole("button", { name: "Edit groups" })).toHaveFocus();
  });

  it("keeps result entry and finalizing in a group stage to a host or organizer", () => {
    const groupStage: GroupStageView = {
      groups: [
        {
          id: "g-A",
          label: "A",
          pairedGroupId: null,
          pairedGroupLabel: null,
          playerIds: ["p1", "p2", "p3", "p4"],
          roundsStarted: 1,
          currentRoundReported: false,
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
    const groupCut = runState({ groupStage });
    groupCut.tournament.format = "group_cut";

    const { unmount } = render(<PodPairingsSection id="t-1" data={groupCut} staff manage />);
    expect(screen.getAllByRole("button", { name: "Enter result" }).length).toBeGreaterThan(0);
    unmount();

    render(<PodPairingsSection id="t-1" data={groupCut} staff={false} manage={false} />);
    expect(screen.queryByRole("button", { name: "Enter result" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Finalize round" })).not.toBeInTheDocument();
  });
});
