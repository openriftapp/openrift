import { describe, expect, it } from "vitest";

import type { PickIdentity, PicksBasket } from "./picks";
import {
  adjustPick,
  basketCopies,
  emptyBasket,
  MAX_PICK_QUANTITY,
  pickedQuantity,
  pickKey,
  picksPayload,
  readBasket,
  removeSeller,
  sellerPicks,
  sellerPicksText,
} from "./picks";

const VOLIBEAR: PickIdentity = {
  idProduct: 847_321,
  finish: "foil",
  idLanguage: 1,
  languageLabel: "Englisch",
  productName: "Volibear, Imposing (V.1 - Rare)",
};

const MARAUDER: PickIdentity = {
  idProduct: 847_358,
  finish: "normal",
  idLanguage: null,
  languageLabel: null,
  productName: "Maddened Marauder",
};

describe("pickKey", () => {
  it("keys on product, finish and language, with unknown language as 0", () => {
    expect(pickKey(VOLIBEAR)).toBe("847321:foil:1");
    expect(pickKey(MARAUDER)).toBe("847358:normal:0");
  });
});

describe("adjustPick", () => {
  it("adds, counts up, counts down and prunes at zero without touching the input", () => {
    const empty = emptyBasket();
    const one = adjustPick(empty, "seller", VOLIBEAR, 1);
    const two = adjustPick(one, "seller", VOLIBEAR, 1);
    const back = adjustPick(two, "seller", VOLIBEAR, -2);

    expect(pickedQuantity(one, "seller", VOLIBEAR)).toBe(1);
    expect(pickedQuantity(two, "seller", VOLIBEAR)).toBe(2);
    expect(back).toEqual(emptyBasket());
    expect(empty).toEqual(emptyBasket());
    expect(pickedQuantity(one, "seller", VOLIBEAR)).toBe(1);
  });

  it("never goes below zero or above the cap", () => {
    const basket = adjustPick(emptyBasket(), "seller", VOLIBEAR, -1);
    expect(basket).toEqual(emptyBasket());

    const capped = adjustPick(emptyBasket(), "seller", VOLIBEAR, MAX_PICK_QUANTITY + 5);
    expect(pickedQuantity(capped, "seller", VOLIBEAR)).toBe(MAX_PICK_QUANTITY);
  });

  it("keeps sellers apart", () => {
    const basket = adjustPick(adjustPick(emptyBasket(), "a", VOLIBEAR, 1), "b", VOLIBEAR, 3);

    expect(pickedQuantity(basket, "a", VOLIBEAR)).toBe(1);
    expect(pickedQuantity(basket, "b", VOLIBEAR)).toBe(3);
    expect(removeSeller(basket, "a").sellers).toEqual({ b: basket.sellers.b });
  });
});

describe("sellerPicks", () => {
  it("counts cards and copies per seller, sorted by seller", () => {
    let basket = adjustPick(emptyBasket(), "zed", VOLIBEAR, 2);
    basket = adjustPick(basket, "zed", MARAUDER, 1);
    basket = adjustPick(basket, "amy", MARAUDER, 4);

    expect(sellerPicks(basket)).toEqual([
      { seller: "amy", cards: 1, copies: 4 },
      { seller: "zed", cards: 2, copies: 3 },
    ]);
    expect(basketCopies(basket)).toBe(7);
  });

  it("reads as a sentence, naming copies only when they differ from cards", () => {
    expect(sellerPicksText({ seller: "amy", cards: 1, copies: 1 })).toBe("1 card from amy");
    expect(sellerPicksText({ seller: "zed", cards: 2, copies: 3 })).toBe(
      "2 cards (3 copies) from zed",
    );
  });
});

describe("picksPayload", () => {
  it("wraps one seller's picks with a version, or nothing when the seller has none", () => {
    const basket = adjustPick(emptyBasket(), "amy", VOLIBEAR, 2);

    expect(picksPayload(basket, "amy")).toEqual({
      v: 1,
      seller: "amy",
      picks: [{ ...VOLIBEAR, quantity: 2 }],
    });
    expect(picksPayload(basket, "zed")).toBeUndefined();
  });
});

describe("readBasket", () => {
  it("drops anything in storage that is not a pick and empty sellers with it", () => {
    const stored: PicksBasket = {
      sellers: {
        amy: { [pickKey(VOLIBEAR)]: { ...VOLIBEAR, quantity: 2 } },
        bad: { x: { idProduct: "nope" } as never },
      },
    };

    expect(readBasket(stored)).toEqual({
      sellers: { amy: { [pickKey(VOLIBEAR)]: { ...VOLIBEAR, quantity: 2 } } },
    });
    expect(readBasket(undefined)).toEqual(emptyBasket());
    expect(readBasket({ sellers: 3 })).toEqual(emptyBasket());
  });
});
