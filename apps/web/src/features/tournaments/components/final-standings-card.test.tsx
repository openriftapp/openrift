import type { FinalStandingRow } from "@openrift/shared/types/api/pod-tournament";
import { render, screen, within } from "@testing-library/react";
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
    const table = within(screen.getByRole("table"));
    expect(table.getByText("Champion")).toBeInTheDocument();
    expect(table.getByText("Lost in final")).toBeInTheDocument();
    expect(table.getByText("Lost in semifinals")).toBeInTheDocument();
    expect(table.getByText("Lost in quarterfinals")).toBeInTheDocument();
    expect(table.getByText("Group stage")).toBeInTheDocument();
    expect(table.getByText("#3")).toBeInTheDocument();
  });

  it("keeps place, result and seed on the phone list", () => {
    const { container } = render(
      <FinalStandingsCard
        cutSize={8}
        rounds={[]}
        legendByPlayer={new Map()}
        rows={[row(1, 3, null, "Ashe"), row(2, 5, 6, "Braum")]}
      />,
    );
    const phone = within(container.querySelector(String.raw`ul.sm\:hidden`) as HTMLElement);
    const items = phone.getAllByRole("listitem");
    expect(within(items[0]!).getByText("Ashe")).toBeInTheDocument();
    expect(within(items[0]!).getByText("Champion")).toBeInTheDocument();
    expect(within(items[0]!).getByText("#3")).toBeInTheDocument();
    expect(within(items[1]!).getByText("Lost in final")).toBeInTheDocument();
  });
});
