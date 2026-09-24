// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { cartFor } from "@/features/groups/lib/buy-cart";
import type { BuyCartItem } from "@/features/groups/lib/buy-cart";
import { createStoreResetter } from "@/test/store-helpers";

import { useBuyCartStore } from "./buy-cart-store";

const JINX: BuyCartItem = { key: "card:c-1", cardId: "c-1", printingId: "p-1", quantity: 1 };
const STAR: BuyCartItem = { key: "printing:p-2", cardId: "c-2", printingId: "p-2", quantity: 2 };

let resetStore: () => void;

beforeEach(() => {
  resetStore = createStoreResetter(useBuyCartStore);
});

afterEach(() => {
  resetStore();
});

function itemsOf(userId: string): BuyCartItem[] {
  return cartFor(useBuyCartStore.getState().carts, userId).items;
}

describe("useBuyCartStore", () => {
  it("starts empty with Cardtrader picked", () => {
    expect(itemsOf("user-1")).toEqual([]);
    expect(useBuyCartStore.getState().marketplace).toBe("cardtrader");
  });

  it("adds items and replaces an item with the same key", () => {
    const store = useBuyCartStore.getState();
    store.addItems("user-1", [JINX, STAR]);
    store.addItems("user-1", [{ ...JINX, printingId: "p-9" }]);
    expect(itemsOf("user-1")).toEqual([{ ...JINX, printingId: "p-9" }, STAR]);
  });

  it("keeps each user's cart apart", () => {
    useBuyCartStore.getState().addItems("user-1", [JINX]);
    expect(itemsOf("user-2")).toEqual([]);
  });

  it("removes items by key", () => {
    const store = useBuyCartStore.getState();
    store.addItems("user-1", [JINX, STAR]);
    store.removeItems("user-1", [JINX.key]);
    expect(itemsOf("user-1")).toEqual([STAR]);
  });

  it("clears the items", () => {
    const store = useBuyCartStore.getState();
    store.addItems("user-1", [JINX]);
    store.clear("user-1");
    expect(itemsOf("user-1")).toEqual([]);
  });

  it("switches an item to another printing", () => {
    const store = useBuyCartStore.getState();
    store.addItems("user-1", [JINX, STAR]);
    store.setPrinting("user-1", JINX.key, "p-9");
    expect(itemsOf("user-1")).toEqual([{ ...JINX, printingId: "p-9" }, STAR]);
  });

  it("switches the marketplace", () => {
    useBuyCartStore.getState().setMarketplace("tcgplayer");
    expect(useBuyCartStore.getState().marketplace).toBe("tcgplayer");
  });

  describe("merge", () => {
    const merge = useBuyCartStore.persist.getOptions().merge;

    function mergeInto(persisted: unknown) {
      return merge?.(persisted, useBuyCartStore.getState()) as ReturnType<
        typeof useBuyCartStore.getState
      >;
    }

    it("keeps valid carts and drops malformed items", () => {
      const merged = mergeInto({
        carts: {
          "user-1": {
            items: [JINX, { key: "bad", quantity: 0 }, "junk"],
          },
          "user-2": "junk",
        },
        marketplace: "cardmarket",
      });
      expect(merged.carts).toEqual({ "user-1": { items: [JINX] } });
      expect(merged.marketplace).toBe("cardmarket");
    });

    it("falls back to defaults for an unknown shape", () => {
      const merged = mergeInto({ carts: 5, marketplace: "ebay" });
      expect(merged.carts).toEqual({});
      expect(merged.marketplace).toBe("cardtrader");
    });

    it("falls back to defaults when nothing was stored", () => {
      const merged = mergeInto(undefined);
      expect(merged.carts).toEqual({});
    });
  });
});
