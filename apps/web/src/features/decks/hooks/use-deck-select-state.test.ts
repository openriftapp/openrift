import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import type { DeckSelectionStore } from "@/features/decks/stores/deck-selection-store";
import { createDeckSelectionStore } from "@/features/decks/stores/deck-selection-store";
import { deckSelectionWrapper } from "@/test/deck-selection";

import { useDeckSelectState } from "./use-deck-select-state";

let store: DeckSelectionStore;
let wrapper: ReturnType<typeof deckSelectionWrapper>;

beforeEach(() => {
  store = createDeckSelectionStore();
  wrapper = deckSelectionWrapper(store);
});

describe("useDeckSelectState", () => {
  it("reports browse mode while the list is not selecting", () => {
    const { result } = renderHook(() => useDeckSelectState("deck-1", false), { wrapper });

    expect(result.current).toEqual({ selectMode: false, selected: false });
  });

  it("follows the deck in and out of the selection", () => {
    store.getState().setSelectMode(true);
    const { result } = renderHook(() => useDeckSelectState("deck-1", false), { wrapper });

    act(() => store.getState().toggleSelect("deck-1"));
    expect(result.current).toEqual({ selectMode: true, selected: true });

    act(() => store.getState().toggleSelect("deck-1"));
    expect(result.current).toEqual({ selectMode: true, selected: false });
  });

  it("ignores another deck's selection", () => {
    store.getState().setSelectMode(true);
    store.getState().toggleSelect("deck-2");

    const { result } = renderHook(() => useDeckSelectState("deck-1", false), { wrapper });

    expect(result.current.selected).toBe(false);
  });

  it("keeps a browser-local deck out of select mode even if its id is selected", () => {
    store.getState().setSelectMode(true);
    store.getState().toggleSelect("local-1");

    const { result } = renderHook(() => useDeckSelectState("local-1", true), { wrapper });

    expect(result.current).toEqual({ selectMode: false, selected: false });
  });
});
