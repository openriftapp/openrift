import type {
  GroupStageView,
  PodResponse,
  PodRoundResponse,
} from "@openrift/shared/types/api/pod-tournament";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { CutBracketEntry } from "./cut-bracket-compact";
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
    drawnGames: 0,
    members: seats.map(([playerId, gamePoints, placement]) => ({
      playerId,
      displayName: playerId,
      image: null,
      gravatarHash: null,
      teamId: null,
      gamePoints,
      placement,
      points: null,
    })),
    penalty: null,
  };
}

function round(
  roundNumber: number,
  pods: PodResponse[],
  status: PodRoundResponse["status"] = "finalized",
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
          legendCharacter: "Ashe",
          legendEpithet: "Frost Archer",
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

const semifinals = round(4, [
  pod("p1", 1, [
    ["Ashe", 2, 1],
    ["Sett", 0, 2],
  ]),
  pod("p2", 2, [
    ["Garen", 1, 2],
    ["Jinx", 2, 1],
  ]),
]);

function entry(onSubmitResult: CutBracketEntry["onSubmitResult"]): CutBracketEntry {
  return {
    matchFormat: "bo3",
    winPoints: 3,
    drawPoints: 1,
    canEnterResult: (current) => current.status === "reporting",
    onSubmitResult,
  };
}

function renderOpenFinal(onSubmitResult: CutBracketEntry["onSubmitResult"] | undefined) {
  return render(
    <CutBracketCompact
      cutSize={4}
      groupStage={stage}
      rounds={[
        semifinals,
        round(
          5,
          [
            pod("p3", 1, [
              ["Ashe", null, null],
              ["Jinx", null, null],
            ]),
          ],
          "reporting",
        ),
      ]}
      entry={onSubmitResult ? entry(onSubmitResult) : undefined}
    />,
  );
}

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
    expect(screen.getAllByText("Semifinals").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Final")).toHaveLength(2);
    expect(screen.getByText("#4")).toBeInTheDocument();
    expect(screen.getByText("SF 1")).toBeInTheDocument();
    expect(screen.getAllByText("Table 1")).toHaveLength(2);
    expect(screen.getAllByText("A")).toHaveLength(6);
    expect(screen.getAllByRole("button", { name: /chooses who starts$/u })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Group A" })).toHaveLength(6);
    // The seat shows the champion only: Ashe twice as a player, twice as her Legend.
    expect(screen.getAllByText("Ashe")).toHaveLength(4);
    expect(screen.getAllByText("–")).toHaveLength(2);
  });

  it("leads the match header with the table and marks only decided seats", () => {
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
              ["Garen", null, null],
              ["Jinx", null, null],
            ]),
          ]),
        ]}
      />,
    );
    const header = screen.getByText("SF 1").parentElement?.parentElement;
    expect(header?.firstElementChild).toHaveTextContent("Table 1");
    const outcomes = [...document.querySelectorAll<HTMLElement>("[data-slot=bracket-seat]")].map(
      (seat) => seat.dataset.outcome ?? null,
    );
    expect(outcomes.slice(0, 4)).toEqual(["won", "lost", null, null]);
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

  it("marks the walkover winner instead of a score", () => {
    render(
      <CutBracketCompact
        cutSize={4}
        groupStage={stage}
        rounds={[
          round(5, [
            pod("p3", 1, [
              ["Ashe", null, 1],
              ["Jinx", null, 2],
            ]),
          ]),
        ]}
      />,
    );
    expect(screen.getByText("W")).toBeInTheDocument();
  });

  it("says both forfeited on a double forfeit", () => {
    render(
      <CutBracketCompact
        cutSize={4}
        groupStage={stage}
        rounds={[
          round(5, [
            pod("p3", 1, [
              ["Ashe", null, 2],
              ["Jinx", null, 2],
            ]),
          ]),
        ]}
      />,
    );
    expect(screen.getByText("Both forfeited")).toBeInTheDocument();
  });

  it("enters a result in the card, without draws", async () => {
    const user = userEvent.setup();
    const onSubmitResult = vi.fn(async () => {});
    renderOpenFinal(onSubmitResult);
    await user.click(screen.getByRole("button", { name: "Enter result" }));
    expect(screen.queryByRole("button", { name: "Game 1: Draw" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Intentional draw" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Game 1: Ashe" }));
    await user.click(screen.getByRole("button", { name: "Game 2: Ashe" }));
    await user.click(screen.getByRole("button", { name: "Save result" }));
    expect(onSubmitResult).toHaveBeenCalledWith("p3", {
      results: [
        { playerId: "Ashe", gamePoints: 2 },
        { playerId: "Jinx", gamePoints: 0 },
      ],
      drawnGames: 0,
    });
    expect(screen.queryByRole("button", { name: "Save result" })).not.toBeInTheDocument();
  });

  it("keeps the form open when the save fails", async () => {
    const user = userEvent.setup();
    renderOpenFinal(async () => {
      throw new Error("offline");
    });
    await user.click(screen.getByRole("button", { name: "Enter result" }));
    await user.click(screen.getByRole("button", { name: "Game 1: Ashe" }));
    await user.click(screen.getByRole("button", { name: "Game 2: Ashe" }));
    await user.click(screen.getByRole("button", { name: "Save result" }));
    expect(screen.getByRole("button", { name: "Save result" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enter result" })).not.toBeInTheDocument();
  });

  it("offers an edit with a reported badge while the round still takes results", () => {
    render(
      <CutBracketCompact
        cutSize={4}
        groupStage={stage}
        rounds={[
          round(
            5,
            [
              pod("p3", 1, [
                ["Ashe", 2, 1],
                ["Jinx", 0, 2],
              ]),
            ],
            "reporting",
          ),
        ]}
        showStatus
        entry={entry(vi.fn())}
      />,
    );
    expect(screen.getByText("Reported")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit result" })).toBeInTheDocument();
  });

  it("keeps the reported badge on a closed round", () => {
    const bracket = (showStatus: boolean) => (
      <CutBracketCompact
        cutSize={4}
        groupStage={stage}
        rounds={[semifinals]}
        showStatus={showStatus}
        entry={entry(vi.fn())}
      />
    );
    const { rerender } = render(bracket(true));
    expect(screen.getAllByText("Reported")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Edit result" })).not.toBeInTheDocument();

    rerender(bracket(false));
    expect(screen.queryByText("Reported")).not.toBeInTheDocument();
  });

  it("offers no entry in a read-only bracket", () => {
    renderOpenFinal(undefined);
    expect(screen.queryByRole("button", { name: "Enter result" })).not.toBeInTheDocument();
  });

  it("folds a finished round behind a toggle while a later one is played", async () => {
    const user = userEvent.setup();
    const { container } = renderOpenFinal(undefined);
    const toggle = screen.getByRole("button", { name: /Semifinals/u });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    const matches = () =>
      container.querySelectorAll<HTMLElement>("[data-slot=bracket-column-matches]")[0];
    expect(matches()).toHaveClass("hidden", "lg:flex");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(matches()).not.toHaveClass("hidden");
  });

  it("renders nothing before the cut is generated", () => {
    const { container } = render(
      <CutBracketCompact cutSize={4} groupStage={{ ...stage, cutGenerated: false }} rounds={[]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
