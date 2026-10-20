import { describe, expect, it } from "vitest";

import { stubPrinting } from "@/test/factories";

import {
  buildCardsViewTileIndex,
  buildCollectionGridItems,
  copyIdsShareOneCard,
  filteredCollectionCount,
} from "./collection-grid-items";
import type { StackedEntry } from "./stacked-entry";

const owned = stubPrinting();
const unowned = stubPrinting();

const stack: StackedEntry = {
  printingId: owned.printingId,
  printing: owned,
  copyIds: ["c1", "c2"],
};

const stackByPrintingId = new Map([[owned.printingId, stack]]);
const collectionIdByCopyId = new Map([
  ["c1", "box-1"],
  ["c2", "box-2"],
]);

describe("buildCollectionGridItems", () => {
  const bird = stubPrinting({ printingId: "pair", side: 1 });
  const gold = stubPrinting({ printingId: "pair", side: 2 });
  const pairStack: StackedEntry = {
    printingId: "pair",
    printing: bird,
    sides: [bird, gold],
    copyIds: ["c1"],
  };
  const pairStacks = new Map([["pair", pairStack]]);

  it("gives each side of a double-sided stack its own tile when stacked", () => {
    const { items, stackByItemId } = buildCollectionGridItems(
      [bird, gold],
      pairStacks,
      collectionIdByCopyId,
      false,
      true,
    );

    expect(items.map((item) => item.id)).toEqual(["pair", "pair:2"]);
    expect(stackByItemId.get("pair:2")).toBe(pairStack);
  });

  it("shows a double-sided copy once when unstacked", () => {
    const { items } = buildCollectionGridItems(
      [bird, gold],
      pairStacks,
      collectionIdByCopyId,
      false,
      false,
    );

    expect(items.map((item) => item.id)).toEqual(["c1"]);
  });

  it("keeps unowned printings in library mode", () => {
    const { items, stackByItemId } = buildCollectionGridItems(
      [owned, unowned],
      stackByPrintingId,
      collectionIdByCopyId,
      true,
      true,
    );

    expect(items.map((item) => item.id)).toEqual([owned.printingId, unowned.printingId]);
    expect(stackByItemId.get(owned.printingId)).toBe(stack);
    expect(stackByItemId.has(unowned.printingId)).toBe(false);
  });

  it("drops unowned printings outside library mode", () => {
    const { items } = buildCollectionGridItems(
      [owned, unowned],
      stackByPrintingId,
      collectionIdByCopyId,
      false,
      true,
    );

    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe(owned.printingId);
  });

  it("expands a stack into one item per copy when unstacked", () => {
    const { items, stackByItemId } = buildCollectionGridItems(
      [owned, unowned],
      stackByPrintingId,
      collectionIdByCopyId,
      false,
      false,
    );

    expect(items.map((item) => item.id)).toEqual(["c1", "c2"]);
    expect(items.map((item) => item.collectionId)).toEqual(["box-1", "box-2"]);
    expect(stackByItemId.get("c1")).toBe(stack);
    expect(stackByItemId.get("c2")).toBe(stack);
  });

  it("leaves the collection id undefined for a copy it doesn't know", () => {
    const { items } = buildCollectionGridItems([owned], stackByPrintingId, new Map(), false, false);

    expect(items[0]?.collectionId).toBeUndefined();
  });
});

describe("copyIdsShareOneCard", () => {
  const first = stubPrinting();
  const second = stubPrinting();
  const stacks: StackedEntry[] = [
    { printingId: first.printingId, printing: first, copyIds: ["a1", "a2"] },
    { printingId: second.printingId, printing: second, copyIds: ["b1"] },
  ];

  it("is true for a single copy", () => {
    expect(copyIdsShareOneCard(["b1"], stacks)).toBe(true);
  });

  it("is true for two copies of the same card", () => {
    expect(copyIdsShareOneCard(["a1", "a2"], stacks)).toBe(true);
  });

  it("is true for a double-sided copy and a plain copy of its second card", () => {
    const bird = stubPrinting({ printingId: "pair", side: 1, cardId: "bird" });
    const gold = stubPrinting({ printingId: "pair", side: 2, cardId: "gold" });
    const plainGold = stubPrinting({ printingId: "solo", cardId: "gold" });
    const mixed: StackedEntry[] = [
      { printingId: "pair", printing: bird, sides: [bird, gold], copyIds: ["p1"] },
      { printingId: "solo", printing: plainGold, copyIds: ["s1"] },
    ];
    expect(copyIdsShareOneCard(["p1", "s1"], mixed)).toBe(true);
  });

  it("is false across two cards", () => {
    expect(copyIdsShareOneCard(["a1", "b1"], stacks)).toBe(false);
  });

  it("is true when no copy resolves to a stack", () => {
    expect(copyIdsShareOneCard(["x1", "x2"], stacks)).toBe(true);
  });
});

describe("buildCardsViewTileIndex", () => {
  it("files a double-sided stack under the tile of each of its cards", () => {
    const bird = stubPrinting({ printingId: "pair", side: 1, cardId: "bird" });
    const gold = stubPrinting({ printingId: "pair", side: 2, cardId: "gold" });
    const plainBird = stubPrinting({ printingId: "single", cardId: "bird" });
    const { allCopyIdsByTile } = buildCardsViewTileIndex(
      [
        { printingId: "single", printing: plainBird, copyIds: ["b1", "b2", "b3"] },
        { printingId: "pair", printing: bird, sides: [bird, gold], copyIds: ["p1"] },
      ],
      "none",
    );

    expect(allCopyIdsByTile.get("bird")).toEqual(["b1", "b2", "b3", "p1"]);
    expect(allCopyIdsByTile.get("gold")).toEqual(["p1"]);
  });
});

describe("filteredCollectionCount", () => {
  const bird = stubPrinting({ printingId: "pair", side: 1, cardId: "bird" });
  const gold = stubPrinting({ printingId: "pair", side: 2, cardId: "gold" });
  const stacks = new Map([
    ["pair", { printingId: "pair", printing: bird, sides: [bird, gold], copyIds: ["c1"] }],
  ]);

  it("counts a double-sided copy once in copies view", () => {
    expect(filteredCollectionCount([bird, gold], "copies", "printings", stacks)).toBe(1);
  });

  it("counts a double-sided printing once in printings view", () => {
    expect(filteredCollectionCount([bird, gold], "printings", "printings", stacks)).toBe(1);
  });

  it("counts each card of a double-sided printing in cards view", () => {
    expect(filteredCollectionCount([bird, gold], "cards", "cards", stacks)).toBe(2);
  });
});
