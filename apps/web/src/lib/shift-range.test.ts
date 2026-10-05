import { describe, expect, it } from "vitest";

import { computeShiftRange } from "./shift-range";

describe("computeShiftRange", () => {
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
  const selfId = (item: { id: string }) => [item.id];

  it("walks forward from the anchor to the clicked tile, inclusive", () => {
    expect(
      computeShiftRange({ items, lastSelectedItemId: "b", itemId: "d", idsForItem: selfId }),
    ).toEqual(["b", "c", "d"]);
  });

  it("walks backward when the clicked tile precedes the anchor", () => {
    expect(
      computeShiftRange({ items, lastSelectedItemId: "d", itemId: "b", idsForItem: selfId }),
    ).toEqual(["b", "c", "d"]);
  });

  it("returns just the tile when the anchor is the clicked tile", () => {
    expect(
      computeShiftRange({ items, lastSelectedItemId: "c", itemId: "c", idsForItem: selfId }),
    ).toEqual(["c"]);
  });

  it("returns null when nothing was clicked before", () => {
    expect(
      computeShiftRange({ items, lastSelectedItemId: null, itemId: "c", idsForItem: selfId }),
    ).toBeNull();
  });

  it("returns null when the anchor is no longer in items (filtered away)", () => {
    expect(
      computeShiftRange({ items, lastSelectedItemId: "gone", itemId: "c", idsForItem: selfId }),
    ).toBeNull();
  });

  it("returns null when the clicked tile is not in items", () => {
    expect(
      computeShiftRange({ items, lastSelectedItemId: "a", itemId: "gone", idsForItem: selfId }),
    ).toBeNull();
  });

  it("returns null for an empty item list", () => {
    expect(
      computeShiftRange({ items: [], lastSelectedItemId: "a", itemId: "b", idsForItem: selfId }),
    ).toBeNull();
  });

  it("accumulates every id a stacked tile stands for", () => {
    const copies: Record<string, string[]> = { a: ["c1", "c2"], b: ["c3"], c: ["c4", "c5"] };
    expect(
      computeShiftRange({
        items,
        lastSelectedItemId: "a",
        itemId: "c",
        idsForItem: (item) => copies[item.id] ?? [],
      }),
    ).toEqual(["c1", "c2", "c3", "c4", "c5"]);
  });

  it("skips tiles that map to no selectable id", () => {
    expect(
      computeShiftRange({
        items,
        lastSelectedItemId: "a",
        itemId: "d",
        idsForItem: (item) => (item.id === "b" || item.id === "c" ? [] : [item.id]),
      }),
    ).toEqual(["a", "d"]);
  });

  it("returns an empty range, distinct from null, when no tile in it is selectable", () => {
    expect(
      computeShiftRange({ items, lastSelectedItemId: "a", itemId: "c", idsForItem: () => [] }),
    ).toEqual([]);
  });
});
