import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { useDeckStats } from "@/features/decks/hooks/use-deck-stats";

import { DeckStatsSummary } from "./deck-stats-summary";

afterEach(cleanup);

const TYPE_LABELS = { unit: "Unit", spell: "Spell", gear: "Gear" };

function stubStats(): ReturnType<typeof useDeckStats> {
  return {
    domainDistribution: [],
    energyCurve: [
      { energy: "1", fury: 2 },
      { energy: "2", fury: 5 },
    ],
    energyCurveStacks: [{ key: "fury", domains: ["fury"] }],
    averageEnergy: 1.7,
    powerCurve: [],
    powerCurveStacks: [],
    averagePower: null,
    typeBreakdown: [
      { type: "unit", total: 30 },
      { type: "spell", total: 1 },
      { type: "gear", total: 3 },
    ],
    typeBreakdownDomains: [],
    totalCards: 34,
  };
}

describe("DeckStatsSummary", () => {
  it("counts types with Gear left uncountable", () => {
    render(
      <DeckStatsSummary
        cards={[]}
        stats={stubStats()}
        cardTypeLabels={TYPE_LABELS}
        onShowAll={vi.fn()}
      />,
    );
    expect(screen.getByText("30 Units · 1 Spell · 3 Gear")).toBeDefined();
  });

  it("opens the full stats from its link", () => {
    const onShowAll = vi.fn();
    render(
      <DeckStatsSummary
        cards={[]}
        stats={stubStats()}
        cardTypeLabels={TYPE_LABELS}
        onShowAll={onShowAll}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "All stats" }));
    expect(onShowAll).toHaveBeenCalledOnce();
  });
});
