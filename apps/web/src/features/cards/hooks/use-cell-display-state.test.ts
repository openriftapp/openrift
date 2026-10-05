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

const front = stubPrinting({ id: "p-front", cardId: "card-1" });
const sibling = stubPrinting({ id: "p-sibling", cardId: "card-1" });

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
