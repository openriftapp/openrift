import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useGridFocusStore } from "@/features/cards/stores/grid-focus-store";
import { useSiblingOverrideStore } from "@/features/cards/stores/sibling-override-store";
import { stubPrinting } from "@/test/factories";
import { createStoreResetter } from "@/test/store-helpers";

import { useCellDisplayState } from "./use-cell-display-state";

const resetFocus = createStoreResetter(useGridFocusStore);
const resetOverrides = createStoreResetter(useSiblingOverrideStore);

afterEach(() => {
  resetFocus();
  resetOverrides();
});

const front = stubPrinting({ printingId: "p-front", cardId: "card-1" });
const sibling = stubPrinting({ printingId: "p-sibling", cardId: "card-1" });

describe("useCellDisplayState", () => {
  it("shows the cell's own printing with no focus or flash by default", () => {
    const { result } = renderHook(() =>
      useCellDisplayState({
        printing: front,
        itemId: "item-1",
        siblings: [front, sibling],
        scope: "cards",
        inCardsView: true,
      }),
    );
    expect(result.current).toEqual({
      displayPrinting: front,
      isSelected: false,
      isFlashing: false,
    });
  });

  it("matches focus and flash by item id or printing id", () => {
    const { result } = renderHook(() =>
      useCellDisplayState({
        printing: front,
        itemId: "item-1",
        siblings: undefined,
        scope: "cards",
        inCardsView: false,
      }),
    );
    act(() => {
      useGridFocusStore.getState().setSelectedItemId("item-1");
      useGridFocusStore.getState().setFlashCardId("p-front");
    });
    expect(result.current.isSelected).toBe(true);
    expect(result.current.isFlashing).toBe(true);
  });

  it("leaves a second side unselected when its printing's first side is selected", () => {
    const gold = stubPrinting({ printingId: "p-front", side: 2, cardId: "card-2" });
    const { result } = renderHook(() =>
      useCellDisplayState({
        printing: gold,
        itemId: "copy-1",
        siblings: undefined,
        scope: "cards",
        inCardsView: false,
      }),
    );
    act(() => {
      useGridFocusStore.getState().setSelectedItemId("p-front");
      useGridFocusStore.getState().setFlashCardId("p-front");
    });
    expect(result.current.isSelected).toBe(false);
    expect(result.current.isFlashing).toBe(false);
  });

  it("swaps in the second side when a card is on both sides of one printing", () => {
    const buff = stubPrinting({ printingId: "p-buff", side: 1, cardId: "card-buff" });
    const buffBack = stubPrinting({ printingId: "p-buff", side: 2, cardId: "card-buff" });
    useSiblingOverrideStore.getState().setOverride("cards", "card-buff", "p-buff:2");
    const { result } = renderHook(() =>
      useCellDisplayState({
        printing: buff,
        itemId: "p-buff",
        siblings: [buff, buffBack],
        scope: "cards",
        inCardsView: true,
      }),
    );
    expect(result.current.displayPrinting).toBe(buffBack);
  });

  it("swaps in the overridden sibling for its own scope in the cards view", () => {
    useSiblingOverrideStore.getState().setOverride("list", "card-1", "p-sibling");
    const { result, rerender } = renderHook(
      ({ scope }: { scope: "list" | "collection" }) =>
        useCellDisplayState({
          printing: front,
          itemId: "item-1",
          siblings: [front, sibling],
          scope,
          inCardsView: true,
        }),
      { initialProps: { scope: "list" } },
    );
    expect(result.current.displayPrinting).toBe(sibling);
    rerender({ scope: "collection" });
    expect(result.current.displayPrinting).toBe(front);
  });

  it("ignores the override outside the cards view or when the sibling is gone", () => {
    useSiblingOverrideStore.getState().setOverride("cards", "card-1", "p-missing");
    const { result, rerender } = renderHook(
      ({ inCardsView }: { inCardsView: boolean }) =>
        useCellDisplayState({
          printing: front,
          itemId: "item-1",
          siblings: [front, sibling],
          scope: "cards",
          inCardsView,
        }),
      { initialProps: { inCardsView: true } },
    );
    expect(result.current.displayPrinting).toBe(front);
    act(() => useSiblingOverrideStore.getState().setOverride("cards", "card-1", "p-sibling"));
    expect(result.current.displayPrinting).toBe(sibling);
    rerender({ inCardsView: false });
    expect(result.current.displayPrinting).toBe(front);
  });
});
