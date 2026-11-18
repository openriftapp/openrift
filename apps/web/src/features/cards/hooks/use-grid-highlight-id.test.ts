import { sideKey } from "@openrift/shared/printing-side";
import type { Printing } from "@openrift/shared/types/catalog";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useGridFocusStore } from "@/features/cards/stores/grid-focus-store";
import type { CardViewerItem } from "@/lib/card-viewer-types";
import { useSelectionStore } from "@/stores/selection-store";
import { stubPrinting } from "@/test/factories";
import { createStoreResetter } from "@/test/store-helpers";

import { useGridHighlightId } from "./use-grid-highlight-id";

const alpha = stubPrinting({ printingId: "p1", cardId: "c1", card: { name: "Alpha" } });
const beta = stubPrinting({ printingId: "p2", cardId: "c2", card: { name: "Beta" } });
const gamma = stubPrinting({ printingId: "p3", cardId: "c3", card: { name: "Gamma" } });

let resetSelection: () => void;
let resetFocus: () => void;

beforeEach(() => {
  resetSelection = createStoreResetter(useSelectionStore);
  resetFocus = createStoreResetter(useGridFocusStore);
});

afterEach(() => {
  resetSelection();
  resetFocus();
});

function renderWith(initial: readonly CardViewerItem[], renderedCards?: readonly Printing[]) {
  return renderHook(({ items }) => useGridHighlightId(items, "printings", renderedCards), {
    initialProps: { items: initial },
  });
}

function published() {
  return useGridFocusStore.getState().selectedItemId;
}

describe("useGridHighlightId", () => {
  it("highlights the tile the selection was made on", () => {
    const items: CardViewerItem[] = [
      { id: "a", printing: alpha },
      { id: "b", printing: beta },
    ];
    useSelectionStore.getState().selectCard(beta, items, "printing", { itemId: "b" });

    const { result } = renderWith(items);

    expect(result.current.highlightId).toBe("b");
    expect(result.current.card).toBe(beta);
    expect(published()).toBe("b");
  });

  it("falls back to the printing when the stored tile id is not in the items", () => {
    const before: CardViewerItem[] = [{ id: "copy-1", printing: alpha }];
    useSelectionStore.getState().selectCard(alpha, before, "printing", { itemId: "copy-1" });

    const { result } = renderWith([{ id: "copy-2", printing: alpha }]);

    expect(result.current.highlightId).toBe("copy-2");
    expect(published()).toBe("copy-2");
  });

  it("highlights a rendered card by its side key when no tile matches the selection's zone", () => {
    const items: CardViewerItem[] = [{ id: "side-a", printing: alpha, zone: "sideboard" }];
    useSelectionStore.getState().selectCard(alpha, items, "card", { zone: "main" });

    const { result } = renderWith(items, [alpha]);

    expect(result.current.item).toBeUndefined();
    expect(result.current.highlightId).toBe(sideKey(alpha));
    expect(published()).toBe(sideKey(alpha));
  });

  it("hands the highlight to the next neighbour when the selected tile is removed", () => {
    const items: CardViewerItem[] = [
      { id: "a", printing: alpha },
      { id: "b", printing: beta },
      { id: "c", printing: gamma },
    ];
    useSelectionStore.getState().selectCard(beta, items, "printing", { itemId: "b" });
    const { result, rerender } = renderWith(items);

    rerender({ items: [items[0]!, items[2]!] });

    expect(result.current.highlightId).toBe("c");
    expect(result.current.card).toBe(gamma);
    expect(published()).toBe("c");
  });

  it("publishes the highlight once the items arrive after the selection", () => {
    useSelectionStore.getState().selectCard(alpha, [], "printing");
    const { result, rerender } = renderWith([]);

    expect(result.current.highlightId).toBeUndefined();
    expect(published()).toBeNull();

    rerender({ items: [{ id: "a", printing: alpha }] });

    expect(result.current.highlightId).toBe("a");
    expect(published()).toBe("a");
  });

  it("clears the published id when the selection clears", () => {
    const items: CardViewerItem[] = [{ id: "a", printing: alpha }];
    useSelectionStore.getState().selectCard(alpha, items, "printing", { itemId: "a" });
    const { rerender } = renderWith(items);
    expect(published()).toBe("a");

    useSelectionStore.getState().closeDetail();
    rerender({ items });

    expect(published()).toBeNull();
  });
});
