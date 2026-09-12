import type {
  GroupQualificationRowView,
  GroupStageGroupView,
  GroupStageView,
  GroupStandingRowView,
} from "@openrift/shared/types/api/pod-tournament";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CutSeedsCard, GroupStandingsCard } from "./group-standings-cards";

vi.mock("@/hooks/use-hydrated", () => ({ useHydrated: () => false }));

function makeRow(
  playerId: string,
  place: number,
  overrides: Partial<GroupStandingRowView> = {},
): GroupStandingRowView {
  return {
    playerId,
    displayName: `Player ${playerId}`,
    status: "active",
    legendCardId: null,
    legendName: null,
    place,
    points: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    gamesWon: 0,
    gamesPlayed: 0,
    gameWinRate: null,
    decidedBy: null,
    ...overrides,
  };
}

function makeGroup(overrides: Partial<GroupStageGroupView> = {}): GroupStageGroupView {
  return {
    id: "g-A",
    label: "A",
    pairedGroupId: null,
    pairedGroupLabel: null,
    playerIds: ["p1", "p2", "p3", "p4"],
    roundsStarted: 3,
    currentRoundReported: true,
    canStartNextRound: false,
    done: true,
    standings: [makeRow("p1", 1), makeRow("p2", 2)],
    ...overrides,
  };
}

function makeStage(overrides: Partial<GroupStageView> = {}): GroupStageView {
  return {
    groups: [makeGroup()],
    ranking: [],
    pendingMetaShares: [],
    stageComplete: true,
    cutGenerated: false,
    seedsDiverged: false,
    finalStandings: null,
    ...overrides,
  };
}

function bodyRows(): HTMLElement[] {
  return within(screen.getByRole("table")).getAllByRole("row").slice(1);
}

describe("GroupStandingsCard", () => {
  it("names the group and counts its players", () => {
    render(<GroupStandingsCard group={makeGroup()} />);
    expect(screen.getByText("Group A")).toBeInTheDocument();
    expect(screen.getByText("4 players")).toBeInTheDocument();
  });

  it("explains the cross-group match on a paired 3-player group", () => {
    render(
      <GroupStandingsCard
        group={makeGroup({
          playerIds: ["p1", "p2", "p3"],
          pairedGroupId: "g-E",
          pairedGroupLabel: "E",
        })}
      />,
    );
    expect(screen.getByText("Paired with Group E")).toBeInTheDocument();
    expect(
      screen.getByText("3 players · one cross-group match each, counted for the cut only"),
    ).toBeInTheDocument();
  });

  it("shows the Legend and the game win rate for each row", () => {
    render(
      <GroupStandingsCard
        group={makeGroup({
          standings: [
            makeRow("p1", 1, {
              displayName: "Ashe",
              legendName: "Ashe, Frost Archer",
              points: 6,
              wins: 2,
              losses: 1,
              gameWinRate: 0.75,
            }),
          ],
        })}
      />,
    );
    const [row] = bodyRows();
    expect(within(row!).getAllByText("Ashe")).toHaveLength(2);
    expect(within(row!).getByText("Frost Archer")).toBeInTheDocument();
    expect(within(row!).getByText("2-1-0")).toBeInTheDocument();
    expect(within(row!).getByText("75%")).toBeInTheDocument();
  });

  it("names the tier that put a row below the one above it", () => {
    render(
      <GroupStandingsCard
        group={makeGroup({
          standings: [makeRow("p1", 1), makeRow("p2", 2, { decidedBy: "h2h" })],
        })}
      />,
    );
    expect(screen.getByText("Below the row above by")).toBeInTheDocument();
    expect(screen.getByText("H2H")).toBeInTheDocument();
  });

  it("leaves the tier column blank when the points differ", () => {
    render(<GroupStandingsCard group={makeGroup()} />);
    expect(screen.queryByText("H2H")).not.toBeInTheDocument();
    expect(screen.queryByText("Draw")).not.toBeInTheDocument();
  });

  it("flags a tie that still needs a meta share", () => {
    render(
      <GroupStandingsCard
        group={makeGroup({
          standings: [makeRow("p1", 1), makeRow("p2", 1, { decidedBy: "meta_pending" })],
        })}
      />,
    );
    expect(screen.getByText("Needs meta share")).toBeInTheDocument();
  });
});

function makeRanking(
  playerId: string,
  displayName: string,
  overrides: Partial<GroupQualificationRowView> = {},
): GroupQualificationRowView {
  return {
    playerId,
    displayName,
    groupLabel: "A",
    place: 1,
    matchWinRate: 1,
    gameWinRate: null,
    legendCount: null,
    metaShare: null,
    decidedBy: null,
    seed: null,
    qualified: false,
    ...overrides,
  };
}

describe("CutSeedsCard", () => {
  const ranking = [
    makeRanking("p1", "Ashe", { groupLabel: "C", gameWinRate: 0.8, seed: 1, qualified: true }),
    makeRanking("p2", "Braum", {
      groupLabel: "B",
      matchWinRate: 0.667,
      gameWinRate: 0.6,
      decidedBy: "mw",
      seed: 2,
      qualified: true,
    }),
    makeRanking("p3", "Caitlyn", {
      place: 2,
      matchWinRate: 0.667,
      gameWinRate: 0.5,
      seed: 3,
      qualified: true,
    }),
    makeRanking("p4", "Darius", {
      groupLabel: "B",
      place: 2,
      matchWinRate: 0.667,
      gameWinRate: 0.4,
      decidedBy: "gw",
    }),
    makeRanking("p5", "Ekko", { groupLabel: "C", place: 3, matchWinRate: 0.333 }),
  ];

  function renderCard(overrides: Partial<GroupStageView> = {}, legendTiebreak = false) {
    return render(
      <CutSeedsCard
        groupStage={makeStage({ ranking, ...overrides })}
        cutSize={4}
        legendTiebreak={legendTiebreak}
      />,
    );
  }

  it("folds a tier that is fully in the cut into seeded chips", () => {
    renderCard();
    expect(screen.getByText("Top 4 seeds")).toBeInTheDocument();
    expect(screen.getByText("Group winners")).toBeInTheDocument();
    expect(screen.getByText("All in the cut")).toBeInTheDocument();
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("Ashe")).toBeInTheDocument();
    expect(screen.queryByText("80%")).not.toBeInTheDocument();
  });

  it("folds a tier that is fully out into muted chips", () => {
    renderCard();
    expect(screen.getByText("Group thirds")).toBeInTheDocument();
    expect(screen.getByText("None in the cut")).toBeInTheDocument();
    expect(screen.getByText("Ekko")).toBeInTheDocument();
  });

  it("tables the tier the cut line crosses with the rates and the deciding criterion", () => {
    renderCard();
    expect(screen.getByText("Runners-up")).toBeInTheDocument();
    const rows = bodyRows();
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getByText("Caitlyn")).toBeInTheDocument();
    expect(within(rows[0]!).getByText("#3")).toBeInTheDocument();
    expect(within(rows[0]!).getByText("50%")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("Darius")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("GW%")).toBeInTheDocument();
    expect(rows[1]).toHaveAttribute("data-cut-line");
  });

  it("adds the Legend columns only with the Legend tiebreak on", () => {
    renderCard({}, true);
    expect(screen.getByText("Legend count")).toBeInTheDocument();
    expect(screen.getByText("Meta share")).toBeInTheDocument();
  });

  it("explains the last seed against the first player out", () => {
    renderCard();
    expect(screen.getByText("Why is Caitlyn in the top 4 and Darius not?")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Both are Runners-up. They are level on match win rate (67%). Caitlyn has the higher game win rate (50% against 40%).",
      ),
    ).toBeInTheDocument();
  });

  it("holds the explanation back while the group stage is still running", () => {
    renderCard({ stageComplete: false });
    expect(screen.queryByText(/Why is/u)).not.toBeInTheDocument();
  });

  it("marks the seeds locked once the cut exists", () => {
    renderCard({ cutGenerated: true });
    expect(screen.getByText("Locked")).toBeInTheDocument();
  });

  it("warns when a corrected group result no longer agrees with the locked seeds", () => {
    renderCard({ cutGenerated: true, seedsDiverged: true });
    expect(
      screen.getByText(
        "A group result was corrected after the cut. Group standings now differ from the locked seeds.",
      ),
    ).toBeInTheDocument();
  });

  it("renders nothing before anyone has qualified", () => {
    const { container } = render(
      <CutSeedsCard groupStage={makeStage()} cutSize={8} legendTiebreak={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
