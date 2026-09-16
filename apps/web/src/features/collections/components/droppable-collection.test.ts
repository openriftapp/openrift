import type { Printing } from "@openrift/shared/types/catalog";
import { describe, expect, it } from "vitest";

import type { CardDragData, ListEntryDragData } from "./dnd-types";
import { isCompatibleCollectionDrop } from "./droppable-collection";

const STUB_PRINTING = { id: "printing-1" } as unknown as Printing;

const collectionDrag: CardDragData = {
  type: "collection-card",
  copyIds: ["copy-1"],
  fromSelection: false,
  isStackDrag: false,
  printing: STUB_PRINTING,
  previewPrintings: [STUB_PRINTING],
  sourceCollectionId: "col-1",
  sourceAllGroupCopies: false,
};

const listDrag: ListEntryDragData = {
  type: "list-entry",
  entryIds: ["entry-1"],
  copyIds: [],
  sourceListId: "list-a",
  sourceKind: "card",
  sourceIntent: "organize",
  totalQuantity: 1,
  printing: STUB_PRINTING,
  cardName: "Card",
};

describe("isCompatibleCollectionDrop", () => {
  it("rejects when nothing is being dragged", () => {
    expect(isCompatibleCollectionDrop(undefined, "col-2")).toBe(false);
  });

  it("accepts a collection card from another collection", () => {
    expect(isCompatibleCollectionDrop(collectionDrag, "col-2")).toBe(true);
  });

  it("rejects a collection card dropped back on its source", () => {
    expect(isCompatibleCollectionDrop(collectionDrag, "col-1")).toBe(false);
  });

  it("accepts group-owned copies on a collection", () => {
    expect(
      isCompatibleCollectionDrop({ ...collectionDrag, sourceAllGroupCopies: true }, "col-2"),
    ).toBe(true);
  });

  it("accepts a copy-kind list entry", () => {
    expect(
      isCompatibleCollectionDrop({ ...listDrag, sourceKind: "copy", copyIds: ["copy-1"] }, "col-2"),
    ).toBe(true);
  });

  it("accepts a card- or printing-kind organize entry", () => {
    expect(isCompatibleCollectionDrop(listDrag, "col-2")).toBe(true);
    expect(isCompatibleCollectionDrop({ ...listDrag, sourceKind: "printing" }, "col-2")).toBe(true);
  });

  it("rejects a card- or printing-kind wish or trade entry", () => {
    expect(isCompatibleCollectionDrop({ ...listDrag, sourceIntent: "wish" }, "col-2")).toBe(false);
    expect(
      isCompatibleCollectionDrop(
        { ...listDrag, sourceKind: "printing", sourceIntent: "trade" },
        "col-2",
      ),
    ).toBe(false);
  });

  it("rejects sidebar reorder drags", () => {
    expect(
      isCompatibleCollectionDrop(
        { type: "sidebar-reorder-collection", collectionId: "col-1" },
        "col-2",
      ),
    ).toBe(false);
  });
});
