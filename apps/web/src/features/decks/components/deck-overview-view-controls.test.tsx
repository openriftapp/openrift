import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDeckOverviewViewStore } from "@/features/decks/stores/deck-overview-view-store";
import { createStoreResetter } from "@/test/store-helpers";

import { DeckOverviewViewControls } from "./deck-overview-view-controls";

const resetStore = createStoreResetter(useDeckOverviewViewStore);

function renderControls(
  overrides: {
    showPrices?: boolean;
    showBands?: boolean;
    paneToggle?: boolean;
    showStatsSummary?: boolean;
    hasStatsSummary?: boolean;
    displayMode?: "grid" | "list";
  } = {},
) {
  const {
    showPrices = false,
    showBands = true,
    paneToggle,
    showStatsSummary = true,
    hasStatsSummary = true,
    displayMode = "grid",
  } = overrides;
  useDeckOverviewViewStore.setState({
    showPrices,
    showOwnershipBands: showBands,
    showStatsSummary,
  });
  render(
    <DeckOverviewViewControls
      displayMode={displayMode}
      ordering={{
        sortBy: "energy",
        sortDir: "asc",
        onSortByChange: vi.fn(),
        onSortDirChange: vi.fn(),
        groupOptions: [],
        groupBy: "type",
        groupDir: "asc",
        onGroupByChange: vi.fn(),
        onGroupDirChange: vi.fn(),
      }}
      columnOverride={null}
      autoColumns={5}
      minColumns={2}
      maxColumnsLimit={8}
      showAllCopies={false}
      showAllRuneCopies={false}
      showBands={showBands}
      showPrices={showPrices}
      showStatsSummary={showStatsSummary}
      hasStatsSummary={hasStatsSummary}
      preferOwned={false}
      canPreferOwned
      hasOwnershipData
      paneToggle={paneToggle}
    />,
  );
}

describe("DeckOverviewViewControls", () => {
  beforeEach(resetStore);
  afterEach(resetStore);

  it("resets every changed option to its default", () => {
    renderControls({ showPrices: true, showBands: false, showStatsSummary: false });
    fireEvent.click(screen.getByRole("button", { name: "Display options, changed" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset to defaults" }));

    const state = useDeckOverviewViewStore.getState();
    expect(state.showPrices).toBe(false);
    expect(state.showOwnershipBands).toBe(true);
    expect(state.showStatsSummary).toBe(true);
  });

  it("hides the stats summary from its switch", () => {
    renderControls();
    fireEvent.click(screen.getByRole("button", { name: "Display options" }));
    fireEvent.click(screen.getByRole("switch", { name: "Show stats summary" }));
    expect(useDeckOverviewViewStore.getState().showStatsSummary).toBe(false);
  });

  it("leaves out the stats summary switch where no summary renders", () => {
    renderControls({ hasStatsSummary: false });
    fireEvent.click(screen.getByRole("button", { name: "Display options" }));
    expect(screen.queryByRole("switch", { name: "Show stats summary" })).toBeNull();
  });

  it("keeps the list's price switch separate from the grid's", () => {
    renderControls({ displayMode: "list", showPrices: true });
    fireEvent.click(screen.getByRole("button", { name: "Display options" }));
    fireEvent.click(screen.getByRole("switch", { name: "Show prices" }));
    const state = useDeckOverviewViewStore.getState();
    expect(state.showListPrices).toBe(false);
    expect(state.showPrices).toBe(true);
  });

  it("offers the ownership switch in the list with a list hint", () => {
    renderControls({ displayMode: "list", showPrices: true });
    fireEvent.click(screen.getByRole("button", { name: "Display options" }));
    expect(
      screen.getByRole("switch", {
        name: "Show ownership Owned and needed copies for each card.",
      }),
    ).toBeTruthy();
  });

  it("offers no reset while every option is at its default", () => {
    renderControls();
    fireEvent.click(screen.getByRole("button", { name: "Display options" }));
    expect(screen.queryByRole("button", { name: "Reset to defaults" })).toBeNull();
  });

  it("can leave out the detail panel toggle", () => {
    renderControls({ paneToggle: false });
    expect(screen.queryByRole("button", { name: "Show the card detail panel" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Hide the card detail panel" })).toBeNull();
  });
});
