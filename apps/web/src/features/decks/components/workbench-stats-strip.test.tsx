import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const stats = vi.hoisted(() => ({
  current: { energyCurve: [] as { energy: number; unit: number }[] },
}));

vi.mock("@/features/decks/hooks/use-deck-builder", () => ({
  useDeckCards: () => [],
  useDeckViolations: () => [],
}));
vi.mock("@/features/decks/hooks/use-decks", () => ({
  useDeckDetail: () => ({ data: { deck: { format: "constructed", formatConfig: null } } }),
}));
vi.mock("@/features/decks/hooks/use-deck-stats", () => ({
  useDeckStats: () => ({
    energyCurve: stats.current.energyCurve,
    energyCurveStacks: [{ key: "unit" }],
    typeBreakdown: [],
  }),
}));
vi.mock("@/hooks/use-enums", () => ({
  useEnumOrders: () => ({ labels: { cardTypes: {} } }),
}));

const { WorkbenchStatsStrip } = await import("./workbench-stats-strip");

function renderWithEnergies(energies: number[]) {
  stats.current.energyCurve = energies.map((energy) => ({ energy, unit: 2 }));
  render(<WorkbenchStatsStrip deckId="deck-1" />);
}

describe("WorkbenchStatsStrip", () => {
  it("hides the energy curve below three distinct energies", () => {
    renderWithEnergies([1, 6]);
    expect(screen.queryByText("Energy")).toBeNull();
  });

  it("shows the energy curve from three distinct energies", () => {
    renderWithEnergies([1, 2, 6]);
    expect(screen.getByText("Energy")).toBeDefined();
  });
});
