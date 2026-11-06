import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDeckOverviewViewStore } from "@/features/decks/stores/deck-overview-view-store";
import { createStoreResetter } from "@/test/store-helpers";

import { DeckOverviewViewControls } from "./deck-overview-view-controls";

const resetStore = createStoreResetter(useDeckOverviewViewStore);

function renderControls(
  overrides: { showPrices?: boolean; showBands?: boolean; paneToggle?: boolean } = {},
) {
  const { showPrices = false, showBands = true, paneToggle } = overrides;
  useDeckOverviewViewStore.setState({ showPrices, showOwnershipBands: showBands });
  render(
    <DeckOverviewViewControls
      displayMode="grid"
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
    renderControls({ showPrices: true, showBands: false });
    fireEvent.click(screen.getByRole("button", { name: "Display options, changed" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset to defaults" }));

    const state = useDeckOverviewViewStore.getState();
    expect(state.showPrices).toBe(false);
    expect(state.showOwnershipBands).toBe(true);
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
