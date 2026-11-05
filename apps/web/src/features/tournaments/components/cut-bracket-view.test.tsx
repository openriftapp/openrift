import type {
  GroupStageView,
  PodResponse,
  PodRoundResponse,
} from "@openrift/shared/types/api/pod-tournament";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CutBracketView } from "./cut-bracket-view";

vi.mock("@/hooks/use-hydrated", () => ({ useHydrated: () => false }));

function pod(
  id: string,
  podNumber: number,
  seats: [string, number | null, number | null, number | null][],
): PodResponse {
  return {
    id,
    podNumber,
    size: 2,
    resultStatus: seats.every((seat) => seat[2] !== null) ? "reported" : "pending",
    members: seats.map(([playerId, gamePoints, placement, points]) => ({
      playerId,
      displayName: playerId,
      image: null,
      gravatarHash: null,
      teamId: null,
      gamePoints,
      placement,
      points,
    })),
    penalty: null,
  };
}

function round(
  roundNumber: number,
  status: PodRoundResponse["status"],
  pods: PodResponse[],
): PodRoundResponse {
  return {
    id: `r-${roundNumber}`,
    roundNumber,
    status,
    pairingStrategy: "cut",
    penaltyTotal: null,
    createdAt: "2026-09-09T10:00:00Z",
    finalizedAt: null,
    pods,
    byes: [],
  };
}

const stage: GroupStageView = {
  groups: [],
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

const semifinals = round(4, "finalized", [
  pod("p1", 1, [
    ["Ashe", 2, 1, 3],
    ["Sett", 0, 2, 0],
  ]),
  pod("p2", 2, [
    ["Garen", 1, 2, 0],
    ["Jinx", 2, 1, 3],
  ]),
]);

const openFinal = round(5, "reporting", [
  pod("p3", 1, [
    ["Ashe", null, null, null],
    ["Jinx", null, null, null],
  ]),
]);

function renderBracket(rounds: PodRoundResponse[], completed: boolean) {
  return render(
    <CutBracketView
      rounds={rounds}
      cutSize={4}
      groupStage={stage}
      scheme="standard"
      matchFormat="bo3"
      winPoints={3}
      drawPoints={1}
      completed={completed}
      canEnterResult={() => false}
      onSubmitResult={async () => {}}
    />,
  );
}

function shownRound(container: HTMLElement): string | undefined {
  const shown = [...container.querySelectorAll("[data-slot='cut-bracket-round']")].filter(
    (element) => !element.classList.contains("hidden"),
  );
  expect(shown).toHaveLength(1);
  return shown[0]?.querySelector("[data-slot='card-title']")?.textContent ?? undefined;
}

describe("CutBracketView", () => {
  it("opens a running event on the round that takes results", () => {
    const { container } = renderBracket([semifinals, openFinal], false);
    const picker = screen.getByRole("group", { name: "Bracket round" });
    expect(within(picker).getByRole("button", { name: "Final" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(shownRound(container)).toContain("Final");
  });

  it("opens a completed event on the first round", () => {
    const { container } = renderBracket([semifinals, openFinal], true);
    expect(screen.getByRole("button", { name: "Semifinals" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(shownRound(container)).toContain("SF 1");
  });

  it("switches rounds from the pills and keeps the pressed pill selected", async () => {
    const user = userEvent.setup();
    const { container } = renderBracket([semifinals, openFinal], false);
    await user.click(screen.getByRole("button", { name: "Semifinals" }));
    expect(shownRound(container)).toContain("SF 1");
    await user.click(screen.getByRole("button", { name: "Semifinals" }));
    expect(screen.getByRole("button", { name: "Semifinals" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("shows the score chip, round points and seeds on every seat", () => {
    renderBracket([semifinals], true);
    expect(screen.getAllByText("+3")).toHaveLength(2);
    expect(screen.getAllByText("+0")).toHaveLength(2);
    expect(screen.getByText("#4")).toBeInTheDocument();
    expect(screen.getAllByTitle("2 game points")).toHaveLength(2);
    expect(screen.getByTitle("1 game points")).toBeInTheDocument();
  });

  it("drops the starter note once the match is reported", () => {
    renderBracket([semifinals, openFinal], false);
    expect(screen.getAllByText("chooses starter")).toHaveLength(1);
  });
});
