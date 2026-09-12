import type {
  GroupStageView,
  PodMemberResponse,
  PodResponse,
  PodRoundResponse,
} from "@openrift/shared/types/api/pod-tournament";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { GroupStageSections } from "./group-stage-sections";

function member(playerId: string, gamePoints: number | null): PodMemberResponse {
  return {
    playerId,
    displayName: playerId,
    teamId: null,
    gamePoints,
    placement: null,
    points: null,
  };
}

function pod(id: string, podNumber: number, members: PodMemberResponse[]): PodResponse {
  const reported = members.every((entry) => entry.gamePoints !== null);
  return {
    id,
    podNumber,
    size: 2,
    resultStatus: reported ? "reported" : "pending",
    members,
    penalty: null,
  };
}

function round(roundNumber: number, pods: PodResponse[]): PodRoundResponse {
  return {
    id: `r-${roundNumber}`,
    roundNumber,
    status: "reporting",
    pairingStrategy: "swiss",
    penaltyTotal: null,
    createdAt: "2026-09-09T10:00:00Z",
    finalizedAt: null,
    pods,
    byes: [],
  };
}

function groupStage(cutGenerated: boolean): GroupStageView {
  return {
    groups: [
      {
        id: "g-A",
        label: "A",
        pairedGroupId: null,
        pairedGroupLabel: null,
        playerIds: ["Ashe", "Garen", "Jinx", "Sett"],
        roundsStarted: 2,
        currentRoundReported: false,
        canStartNextRound: false,
        done: false,
        standings: [],
      },
    ],
    ranking: [],
    pendingMetaShares: [],
    stageComplete: false,
    cutGenerated,
    seedsDiverged: false,
    finalStandings: null,
  };
}

const rounds = [
  round(1, [
    pod("pod-1", 1, [member("Ashe", 2), member("Garen", 0)]),
    pod("pod-2", 2, [member("Jinx", 2), member("Sett", 1)]),
  ]),
  round(2, [
    pod("pod-3", 1, [member("Ashe", null), member("Jinx", null)]),
    pod("pod-4", 2, [member("Garen", null), member("Sett", null)]),
  ]),
];

function renderSections(cutGenerated: boolean) {
  return render(
    <GroupStageSections
      groupStage={groupStage(cutGenerated)}
      rounds={rounds}
      scheme="standard"
      matchFormat="bo3"
      winPoints={3}
      drawPoints={1}
      canEnterResult
      onSubmitResult={vi.fn()}
    />,
  );
}

describe("GroupStageSections", () => {
  it("expands an earlier round to its pod cards with editable results", async () => {
    const user = userEvent.setup();
    renderSections(false);

    expect(screen.queryAllByRole("button", { name: "Edit result" })).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Expand round 1" }));

    expect(screen.getByRole("button", { name: "Collapse round 1" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Edit result" })).toHaveLength(2);
  });

  it("keeps earlier rounds readable but locked once the cut is generated", async () => {
    const user = userEvent.setup();
    renderSections(true);

    await user.click(screen.getByRole("button", { name: "Expand round 1" }));

    expect(screen.getAllByText("Ashe")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Edit result" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Enter result" })).toHaveLength(2);
  });
});
