import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useGridSelectionStore } from "@/features/cards/stores/grid-selection-store";
import { createStoreResetter } from "@/test/store-helpers";

import { useDeckSelectionStore } from "./deck-selection-store";

let resetDecks: () => void;
let resetGrid: () => void;

beforeEach(() => {
  resetDecks = createStoreResetter(useDeckSelectionStore);
  resetGrid = createStoreResetter(useGridSelectionStore);
});

afterEach(() => {
  resetDecks();
  resetGrid();
});

describe("useDeckSelectionStore", () => {
  it("toggles a single deck in and out of the selection", () => {
    useDeckSelectionStore.getState().toggleSelect("deck-1");
    expect(useDeckSelectionStore.getState().selected).toEqual(new Set(["deck-1"]));

    useDeckSelectionStore.getState().toggleSelect("deck-1");
    expect(useDeckSelectionStore.getState().selected.size).toBe(0);
  });

  it("selects every visible deck and keeps decks selected before", () => {
    useDeckSelectionStore.getState().toggleSelect("deck-hidden");

    useDeckSelectionStore.getState().toggleStack(["deck-1", "deck-2"]);

    expect(useDeckSelectionStore.getState().selected).toEqual(
      new Set(["deck-hidden", "deck-1", "deck-2"]),
    );
  });

  it("deselects the visible decks when they are all selected already", () => {
    useDeckSelectionStore.getState().toggleStack(["deck-1", "deck-2"]);

    useDeckSelectionStore.getState().toggleStack(["deck-1", "deck-2"]);

    expect(useDeckSelectionStore.getState().selected.size).toBe(0);
  });

  it("ignores select-all when no deck is visible", () => {
    useDeckSelectionStore.getState().toggleSelect("deck-1");

    useDeckSelectionStore.getState().toggleStack([]);

    expect(useDeckSelectionStore.getState().selected).toEqual(new Set(["deck-1"]));
  });

  it("drops the selection and leaves select mode on reset", () => {
    useDeckSelectionStore.getState().setSelectMode(true);
    useDeckSelectionStore.getState().toggleSelect("deck-1");

    useDeckSelectionStore.getState().resetSelection();

    expect(useDeckSelectionStore.getState().selectMode).toBe(false);
    expect(useDeckSelectionStore.getState().selected.size).toBe(0);
  });

  it("does not share state with the card grid selection", () => {
    useDeckSelectionStore.getState().setSelectMode(true);
    useDeckSelectionStore.getState().toggleSelect("deck-1");

    expect(useGridSelectionStore.getState().selectMode).toBe(false);
    expect(useGridSelectionStore.getState().selected.size).toBe(0);
  });
});
