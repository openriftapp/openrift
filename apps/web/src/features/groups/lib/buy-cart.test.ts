import type { CollectionResponse } from "@openrift/shared/types/api/collection";
import { describe, expect, it, vi } from "vitest";

import type { BuyCartItem } from "./buy-cart";
import {
  cartCardLines,
  cartFor,
  cartItemForWanted,
  cartTotal,
  fileOrder,
  findOrderedCollection,
  massEntryLines,
  withPrinting,
} from "./buy-cart";
import type { WantedCard } from "./wanted-cards";

const JINX: BuyCartItem = { key: "card:c-1", cardId: "c-1", printingId: "p-1", quantity: 1 };
const STAR: BuyCartItem = { key: "printing:p-2", cardId: "c-2", printingId: "p-2", quantity: 2 };

describe("cartFor", () => {
  it("returns the user's own cart", () => {
    const cart = { items: [JINX] };
    expect(cartFor({ "user-1": cart }, "user-1")).toBe(cart);
  });

  it("returns an empty cart for someone with none", () => {
    expect(cartFor({}, "user-1")).toEqual({ items: [] });
  });
});

describe("cartItemForWanted", () => {
  const cardWish: WantedCard = {
    key: "card:c-1",
    kind: "card",
    cardId: "c-1",
    printingId: null,
    quantity: 2,
    ruleQuantity: 0,
    listNames: ["Wants"],
    entries: [],
  };

  it("uses the shown printing for a card wish", () => {
    expect(cartItemForWanted(cardWish, "p-7")).toEqual({
      key: "card:c-1",
      cardId: "c-1",
      printingId: "p-7",
      quantity: 2,
    });
  });

  it("keeps a printing wish's own printing", () => {
    expect(
      cartItemForWanted({ ...cardWish, kind: "printing", printingId: "p-1" }, "p-7")?.printingId,
    ).toBe("p-1");
  });

  it("gives up when a card wish has no printing to show", () => {
    expect(cartItemForWanted(cardWish, undefined)).toBeNull();
  });
});

describe("cartCardLines", () => {
  it("names each item with its quantity", () => {
    expect(cartCardLines([JINX, STAR], (item) => item.cardId)).toEqual([
      { name: "c-1", quantity: 1 },
      { name: "c-2", quantity: 2 },
    ]);
  });
});

describe("massEntryLines", () => {
  it("maps items to product lines and sets aside printings TCGplayer doesn't list", () => {
    const productIds: Record<string, number | null> = { "p-1": 652_993, "p-2": null };
    expect(massEntryLines([JINX, STAR], (printingId) => productIds[printingId])).toEqual({
      lines: [{ productId: 652_993, quantity: 1 }],
      unlisted: [STAR],
    });
  });
});

describe("cartTotal", () => {
  it("adds prices per copy and counts unpriced copies apart", () => {
    const prices: Record<string, number> = { "p-1": 12.5 };
    expect(cartTotal([JINX, STAR], (printingId) => prices[printingId])).toEqual({
      total: 12.5,
      unpriced: 2,
    });
  });
});

function stubCollection(overrides: Partial<CollectionResponse> = {}): CollectionResponse {
  return {
    id: "col-1",
    name: "Ordered (Marketplace)",
    groupId: null,
    ...overrides,
  } as CollectionResponse;
}

describe("findOrderedCollection", () => {
  it("finds the collection marked for marketplace orders, whatever its name", () => {
    const ordered = stubCollection({
      id: "col-ordered",
      name: "Post",
      purpose: "marketplace_orders",
    });
    expect(findOrderedCollection([stubCollection(), ordered])).toBe(ordered);
  });

  it("finds nothing when no collection carries the mark", () => {
    expect(findOrderedCollection([stubCollection()])).toBeUndefined();
  });
});

describe("withPrinting", () => {
  it("switches the printing of one item", () => {
    expect(withPrinting([JINX, STAR], JINX.key, "p-9")).toEqual([
      { ...JINX, printingId: "p-9" },
      STAR,
    ]);
  });
});

describe("fileOrder", () => {
  function stubDeps() {
    return {
      collectionId: vi.fn(async () => "col-ordered"),
      addCopies: vi.fn(async (_copies: { printingId: string; collectionId: string }[]) => []),
      decrementEntries: vi.fn(async (_entries: { entryId: string; by: number }[]) => null),
    };
  }

  const wanted: WantedCard = {
    key: STAR.key,
    kind: "printing",
    cardId: "c-2",
    printingId: "p-2",
    quantity: 3,
    ruleQuantity: 0,
    listNames: ["Wants"],
    entries: [
      { listId: "list-1", listName: "Wants", entryId: "entry-1", spare: 1 },
      { listId: "list-2", listName: "Deck", entryId: "entry-2", spare: 2 },
    ],
  };

  it("adds one copy per ordered card to the ordered collection", async () => {
    const deps = stubDeps();
    await fileOrder(deps, [JINX, STAR], new Map());
    expect(deps.addCopies).toHaveBeenCalledWith([
      { printingId: "p-1", collectionId: "col-ordered" },
      { printingId: "p-2", collectionId: "col-ordered" },
      { printingId: "p-2", collectionId: "col-ordered" },
    ]);
  });

  it("sends at most 500 copies per request", async () => {
    const deps = stubDeps();
    await fileOrder(deps, [{ ...JINX, quantity: 501 }], new Map());
    expect(deps.addCopies.mock.calls.map(([copies]) => copies.length)).toEqual([500, 1]);
  });

  it("lowers the wish entries that asked for the ordered copies", async () => {
    const deps = stubDeps();
    await fileOrder(deps, [STAR], new Map([[STAR.key, wanted]]));
    expect(deps.decrementEntries).toHaveBeenCalledWith([
      { entryId: "entry-1", by: 1 },
      { entryId: "entry-2", by: 1 },
    ]);
  });

  it("skips the wish update when no entry asked for the card", async () => {
    const deps = stubDeps();
    await fileOrder(deps, [JINX], new Map());
    expect(deps.decrementEntries).not.toHaveBeenCalled();
  });

  it("still finishes when the wish update fails after the copies are in", async () => {
    const deps = stubDeps();
    deps.decrementEntries.mockRejectedValueOnce(new Error("offline"));
    await expect(fileOrder(deps, [STAR], new Map([[STAR.key, wanted]]))).resolves.toBeUndefined();
  });

  it("leaves the wish lists alone when adding the copies fails", async () => {
    const deps = stubDeps();
    deps.addCopies.mockRejectedValueOnce(new Error("offline"));
    await expect(fileOrder(deps, [STAR], new Map([[STAR.key, wanted]]))).rejects.toThrow("offline");
    expect(deps.decrementEntries).not.toHaveBeenCalled();
  });
});
