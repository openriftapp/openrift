import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { CardViewerItem } from "@/lib/card-viewer-types";
import { useSelectionStore } from "@/stores/selection-store";
import { stubPrinting } from "@/test/factories";
import { createStoreResetter } from "@/test/store-helpers";

import { useCloseRemovedSelection } from "./use-close-removed-selection";

const alpha = stubPrinting({ printingId: "p1", cardId: "c1", card: { name: "Alpha" } });
const copies: CardViewerItem[] = [{ id: "copy-1", printing: alpha }];

let resetStore: () => void;

beforeEach(() => {
  resetStore = createStoreResetter(useSelectionStore);
});

afterEach(() => {
  resetStore();
});

function renderWith(initial: readonly CardViewerItem[]) {
  return renderHook(({ items }) => useCloseRemovedSelection(items), {
    initialProps: { items: initial },
  });
}

describe("useCloseRemovedSelection", () => {
  it("closes the detail when the last copy of a list-bound selection is gone", () => {
    useSelectionStore
      .getState()
      .selectCard(alpha, copies, "printing", { itemId: "copy-1", outlivesList: false });
    const { rerender } = renderWith(copies);
    expect(useSelectionStore.getState().detailOpen).toBe(true);

    rerender({ items: [] });

    expect(useSelectionStore.getState().detailOpen).toBe(false);
    expect(useSelectionStore.getState().selectedCard).toBeNull();
  });

  it("keeps a selection that may outlive its list", () => {
    useSelectionStore.getState().selectCard(alpha, copies, "printing", { itemId: "copy-1" });
    const { rerender } = renderWith(copies);

    rerender({ items: [] });

    expect(useSelectionStore.getState().detailOpen).toBe(true);
    expect(useSelectionStore.getState().selectedCard?.printingId).toBe("p1");
  });
});
