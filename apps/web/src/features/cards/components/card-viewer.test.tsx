import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createCardRowActionsStore } from "@/features/cards/stores/card-row-actions-store";
import { useSelectionStore } from "@/stores/selection-store";
import { resetIdCounter, stubCardViewerItem } from "@/test/factories";
import { rowActionsWrapper } from "@/test/row-actions";
import { createStoreResetter } from "@/test/store-helpers";

vi.mock("@/features/cards/components/card-browser-layout", () => ({
  CardBrowserLayout: () => null,
  useCardBrowserLayoutOffsets: () => ({ toolbarOffset: 0, stickyOffset: 0 }),
}));
vi.mock("@/features/cards/components/card-grid", () => ({ CardGrid: () => null }));
vi.mock("@/features/cards/components/card-table", () => ({ CardTable: () => null }));

const { CardViewer } = await import("./card-viewer");

let resetSelection: () => void;

beforeEach(() => {
  resetIdCounter();
  resetSelection = createStoreResetter(useSelectionStore);
});

afterEach(() => {
  resetSelection();
});

function press(key: string) {
  act(() => {
    globalThis.dispatchEvent(new KeyboardEvent("keydown", { key, cancelable: true }));
  });
}

describe("CardViewer keyboard row actions", () => {
  it("sends + and - on the selected card to the surface's handlers", () => {
    const items = [stubCardViewerItem(), stubCardViewerItem()];
    const surface = createCardRowActionsStore();
    const onIncrement = vi.fn();
    const onDecrement = vi.fn();
    surface.getState().setHandlers({ onIncrement, onDecrement });
    useSelectionStore.getState().selectCard(items[1]!.printing, items, "printing");

    render(<CardViewer items={items} totalItems={items.length} renderCard={() => null} />, {
      wrapper: rowActionsWrapper(surface),
    });
    press("+");
    press("-");

    expect(onIncrement).toHaveBeenCalledWith(items[1]!.printing);
    expect(onDecrement).toHaveBeenCalledWith(items[1]!.printing, undefined);
  });
});
