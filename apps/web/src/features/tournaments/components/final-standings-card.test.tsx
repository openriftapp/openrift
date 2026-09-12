import type { FinalStandingRow } from "@openrift/shared/types/api/pod-tournament";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FinalStandingsCard } from "./final-standings-card";

vi.mock("@/hooks/use-hydrated", () => ({ useHydrated: () => false }));

function row(
  place: number,
  seed: number | null,
  exitRound: number | null,
  displayName = `P${place}`,
): FinalStandingRow {
  return {
    playerId: `p${place}`,
    displayName,
    place,
    seed,
    groupLabel: "A",
    groupPlace: 1,
    exitRound,
  };
}

describe("FinalStandingsCard", () => {
  it("labels the champion, each cut exit, and the group stage", () => {
    render(
      <FinalStandingsCard
        cutSize={8}
        rounds={[]}
        legendByPlayer={new Map()}
        rows={[row(1, 3, null), row(2, 5, 6), row(3, 1, 5), row(5, 2, 4), row(9, null, null)]}
      />,
    );
    expect(screen.getByText("Champion")).toBeInTheDocument();
    expect(screen.getByText("Lost in final")).toBeInTheDocument();
    expect(screen.getByText("Lost in semifinals")).toBeInTheDocument();
    expect(screen.getByText("Lost in quarterfinals")).toBeInTheDocument();
    expect(screen.getByText("Group stage")).toBeInTheDocument();
    expect(screen.getByText("#3")).toBeInTheDocument();
  });
});
