// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { createGridSelectionStore } from "@/features/cards/stores/grid-selection-store";
import { deckSelectionWrapper } from "@/test/deck-selection";

import type { DeckSelectionStore } from "./deck-selection-store";
import { createDeckSelectionStore, useDeckSelectionStore } from "./deck-selection-store";

let store: DeckSelectionStore;

beforeEach(() => {
  store = createDeckSelectionStore();
});

describe("createDeckSelectionStore", () => {
  it("toggles a single deck in and out of the selection", () => {
    store.getState().toggleSelect("deck-1");
    expect(store.getState().selected).toEqual(new Set(["deck-1"]));

    store.getState().toggleSelect("deck-1");
    expect(store.getState().selected.size).toBe(0);
  });

  it("selects every visible deck and keeps decks selected before", () => {
    store.getState().toggleSelect("deck-hidden");

    store.getState().toggleStack(["deck-1", "deck-2"]);

    expect(store.getState().selected).toEqual(new Set(["deck-hidden", "deck-1", "deck-2"]));
  });

  it("deselects the visible decks when they are all selected already", () => {
    store.getState().toggleStack(["deck-1", "deck-2"]);

    store.getState().toggleStack(["deck-1", "deck-2"]);

    expect(store.getState().selected.size).toBe(0);
  });

  it("ignores select-all when no deck is visible", () => {
    store.getState().toggleSelect("deck-1");

    store.getState().toggleStack([]);

    expect(store.getState().selected).toEqual(new Set(["deck-1"]));
  });

  it("drops the selection and leaves select mode on reset", () => {
    store.getState().setSelectMode(true);
    store.getState().toggleSelect("deck-1");

    store.getState().resetSelection();

    expect(store.getState().selectMode).toBe(false);
    expect(store.getState().selected.size).toBe(0);
  });

  it("does not share state with the card grid selection", () => {
    const grid = createGridSelectionStore();
    store.getState().setSelectMode(true);
    store.getState().toggleSelect("deck-1");

    expect(grid.getState().selectMode).toBe(false);
    expect(grid.getState().selected.size).toBe(0);
  });

  it("keeps each store's selection to itself", () => {
    store.getState().toggleSelect("deck-1");
    expect(createDeckSelectionStore().getState().selected.size).toBe(0);
  });
});

describe("useDeckSelectionStore", () => {
  it("reads the selection of the enclosing page", () => {
    const first = renderHook(() => useDeckSelectionStore((state) => state.selected.size), {
      wrapper: deckSelectionWrapper(store),
    });
    const other = renderHook(() => useDeckSelectionStore((state) => state.selected.size), {
      wrapper: deckSelectionWrapper(),
    });

    act(() => store.getState().toggleStack(["deck-1", "deck-2"]));

    expect(first.result.current).toBe(2);
    expect(other.result.current).toBe(0);
  });

  it("throws outside a DeckListPage", () => {
    expect(() => renderHook(() => useDeckSelectionStore((state) => state.selected))).toThrow(
      "useDeckSelectionStore needs a DeckListPage",
    );
  });
});
