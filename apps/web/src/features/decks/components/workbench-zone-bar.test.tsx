import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useWorkbenchStore } from "@/features/decks/stores/workbench-store";
import { createStoreResetter } from "@/test/store-helpers";

vi.mock("@/features/decks/hooks/use-deck-builder", () => ({
  useDeckCards: () => [],
}));
vi.mock("@/features/decks/hooks/use-decks", () => ({
  useDeckDetail: () => ({ data: { deck: { format: "constructed", formatConfig: null } } }),
}));
vi.mock("@/hooks/use-enums", () => ({
  useZoneOrder: () => ({ zoneOrder: ["legend", "champion", "main", "battlefield", "runes"] }),
}));

const { WorkbenchZoneBar } = await import("./workbench-zone-bar");

const resetStore = createStoreResetter(useWorkbenchStore);

describe("WorkbenchZoneBar", () => {
  beforeEach(resetStore);
  afterEach(resetStore);

  it("narrows to fitting cards until the user asks for all of them", () => {
    render(<WorkbenchZoneBar deckId="deck-1" zone="runes" onTargetZone={vi.fn()} />);
    expect(screen.getByText(/Showing cards allowed here/u)).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Show all cards" }));

    expect(useWorkbenchStore.getState().showAllCardsZones.has("runes")).toBe(true);
    expect(screen.getByText(/Showing all cards/u)).toBeDefined();
  });

  it("turns the fit back on", () => {
    useWorkbenchStore.getState().setShowAllCards("runes", true);
    render(<WorkbenchZoneBar deckId="deck-1" zone="runes" onTargetZone={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Only allowed cards" }));

    expect(useWorkbenchStore.getState().showAllCardsZones.has("runes")).toBe(false);
  });
});
