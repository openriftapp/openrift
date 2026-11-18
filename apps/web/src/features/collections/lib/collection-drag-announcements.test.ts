import type { Active, Over } from "@dnd-kit/core";
import { describe, expect, it } from "vitest";

import { stubPrinting } from "@/test/factories";

import { collectionDragAnnouncements } from "./collection-drag-announcements";
import type { CardDragData } from "./dnd-types";

function active(data: unknown): Active {
  return {
    id: "internal-drag-id",
    data: { current: data as Record<string, unknown> },
    rect: { current: { initial: null, translated: null } },
  };
}

function over(data: unknown): Over {
  return {
    id: "internal-drop-id",
    data: { current: data as Record<string, unknown> },
    rect: { top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 },
    disabled: false,
  };
}

const card = active({
  type: "collection-card",
  copyIds: ["c1"],
  fromSelection: false,
  isStackDrag: false,
  printing: stubPrinting({ card: { name: "Jinx, Loose Cannon" } }),
  previewPrintings: [],
  sourceCollectionId: "col-1",
  sourceAllGroupCopies: false,
} satisfies CardDragData);

const binder = { type: "collection", collectionId: "col-2", collectionName: "Trade Binder" };

describe("collectionDragAnnouncements", () => {
  it("names the picked-up card", () => {
    expect(collectionDragAnnouncements.onDragStart({ active: card })).toBe(
      "Picked up Jinx, Loose Cannon.",
    );
  });

  it("names the collection a card is over and dropped on", () => {
    expect(collectionDragAnnouncements.onDragOver?.({ active: card, over: over(binder) })).toBe(
      "Jinx, Loose Cannon is over Trade Binder.",
    );
    expect(collectionDragAnnouncements.onDragEnd({ active: card, over: over(binder) })).toBe(
      "Dropped Jinx, Loose Cannon on Trade Binder.",
    );
  });

  it("names the list a list entry is over", () => {
    const entry = active({ type: "list-entry", cardName: "Vi, Piltover Enforcer" });
    const wishlist = over({ type: "list", listId: "l1", listName: "Summoner Skirmish wants" });

    expect(collectionDragAnnouncements.onDragOver?.({ active: entry, over: wishlist })).toBe(
      "Vi, Piltover Enforcer is over Summoner Skirmish wants.",
    );
  });

  it("names a reordered sidebar row and the row it moves over", () => {
    const row = active({ type: "sidebar-reorder-collection", collectionId: "a", label: "Binder" });
    const other = over({ type: "sidebar-reorder-collection", collectionId: "b", label: "Box" });

    expect(collectionDragAnnouncements.onDragOver?.({ active: row, over: other })).toBe(
      "Binder is over Box.",
    );
  });

  it("says nothing moved when a drag ends over no named target", () => {
    expect(collectionDragAnnouncements.onDragEnd({ active: card, over: over({}) })).toBe(
      "Dropped Jinx, Loose Cannon. Nothing moved.",
    );
    expect(collectionDragAnnouncements.onDragOver?.({ active: card, over: null })).toBe(
      "Jinx, Loose Cannon is not over a drop area.",
    );
    expect(collectionDragAnnouncements.onDragCancel({ active: card, over: null })).toBe(
      "Dropped Jinx, Loose Cannon. Nothing moved.",
    );
  });
});
