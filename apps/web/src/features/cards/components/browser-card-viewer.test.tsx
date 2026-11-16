import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CardViewerItem } from "@/lib/card-viewer-types";
import { useSelectionStore } from "@/stores/selection-store";
import { resetIdCounter, stubCardViewerItem } from "@/test/factories";
import { createStoreResetter } from "@/test/store-helpers";

import { BrowserCardViewer } from "./browser-card-viewer";

const renderedSelections: (string | undefined)[] = [];

vi.mock("@/features/cards/components/card-viewer", () => ({
  CardViewer: ({ selectedItemId }: { selectedItemId?: string }) => {
    renderedSelections.push(selectedItemId);
    return null;
  },
}));

let resetStore: () => void;

beforeEach(() => {
  resetStore = createStoreResetter(useSelectionStore);
  resetIdCounter();
  renderedSelections.length = 0;
});

afterEach(() => {
  resetStore();
});

function viewer(items: CardViewerItem[]) {
  return (
    <BrowserCardViewer
      items={items}
      totalItems={items.length}
      renderCard={() => null}
      renderedCards={items.map((item) => item.printing)}
      printingsByCardId={new Map()}
      view="printings"
    />
  );
}

describe("BrowserCardViewer", () => {
  it("never renders the highlight on the tile that slid into the selected index", () => {
    const items = [stubCardViewerItem(), stubCardViewerItem(), stubCardViewerItem()];
    const [first, second, third] = items;
    useSelectionStore.getState().selectCard(second!.printing, items, "printing");
    const { rerender } = render(viewer(items));
    renderedSelections.length = 0;

    rerender(viewer([second!, first!, third!]));

    expect(renderedSelections).toEqual([second!.id]);
  });

  it("highlights the clicked copy when two tiles share a printing", () => {
    const original = stubCardViewerItem();
    const items = [
      { id: "copy-1", printing: original.printing },
      { id: "copy-2", printing: original.printing },
    ];
    useSelectionStore
      .getState()
      .selectCard(original.printing, items, "printing", { itemId: "copy-2" });

    render(viewer(items));

    expect(renderedSelections.at(-1)).toBe("copy-2");
  });
});
