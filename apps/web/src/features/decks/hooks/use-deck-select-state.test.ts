import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useDeckSelectionStore } from "@/features/decks/stores/deck-selection-store";
import { createStoreResetter } from "@/test/store-helpers";

import { useDeckSelectState } from "./use-deck-select-state";

let resetStore: () => void;

beforeEach(() => {
  resetStore = createStoreResetter(useDeckSelectionStore);
});

afterEach(() => {
  resetStore();
});

describe("useDeckSelectState", () => {
  it("reports browse mode while the list is not selecting", () => {
    const { result } = renderHook(() => useDeckSelectState("deck-1", false));

    expect(result.current).toEqual({ selectMode: false, selected: false });
  });

  it("follows the deck in and out of the selection", () => {
    useDeckSelectionStore.getState().setSelectMode(true);
    const { result } = renderHook(() => useDeckSelectState("deck-1", false));

    act(() => useDeckSelectionStore.getState().toggleSelect("deck-1"));
    expect(result.current).toEqual({ selectMode: true, selected: true });

    act(() => useDeckSelectionStore.getState().toggleSelect("deck-1"));
    expect(result.current).toEqual({ selectMode: true, selected: false });
  });

  it("ignores another deck's selection", () => {
    useDeckSelectionStore.getState().setSelectMode(true);
    useDeckSelectionStore.getState().toggleSelect("deck-2");

    const { result } = renderHook(() => useDeckSelectState("deck-1", false));

    expect(result.current.selected).toBe(false);
  });

  it("keeps a browser-local deck out of select mode even if its id is selected", () => {
    useDeckSelectionStore.getState().setSelectMode(true);
    useDeckSelectionStore.getState().toggleSelect("local-1");

    const { result } = renderHook(() => useDeckSelectState("local-1", true));

    expect(result.current).toEqual({ selectMode: false, selected: false });
  });
});
