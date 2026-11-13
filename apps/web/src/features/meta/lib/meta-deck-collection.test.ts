import { describe, expect, it } from "vitest";

import {
  decodeMetaDeckCardIndex,
  metaCardOwnershipBand,
  metaDeckCosts,
  ownedCountsByCardId,
  partialListDeckIds,
} from "./meta-deck-collection";

describe("decodeMetaDeckCardIndex", () => {
  it("turns pooled positions back into card ids", () => {
    const decoded = decodeMetaDeckCardIndex({
      cards: ["card-a", "card-b"],
      decks: [
        { deckId: "deck-1", entries: [0, 3, 1, 1], sideboard: [] },
        { deckId: "deck-2", entries: [1, 2], sideboard: [] },
      ],
    });
    expect([...(decoded.get("deck-1")?.main ?? [])]).toEqual([
      ["card-a", 3],
      ["card-b", 1],
    ]);
    expect([...(decoded.get("deck-2")?.main ?? [])]).toEqual([["card-b", 2]]);
  });

  it("keeps the sideboard apart from the rest of the list", () => {
    const decoded = decodeMetaDeckCardIndex({
      cards: ["card-a", "card-b"],
      decks: [{ deckId: "deck-1", entries: [0, 3], sideboard: [0, 1, 1, 2] }],
    });
    expect([...(decoded.get("deck-1")?.main ?? [])]).toEqual([["card-a", 3]]);
    expect([...(decoded.get("deck-1")?.side ?? [])]).toEqual([
      ["card-a", 1],
      ["card-b", 2],
    ]);
  });

  it("drops a pair naming a card outside the pool", () => {
    const decoded = decodeMetaDeckCardIndex({
      cards: ["card-a"],
      decks: [{ deckId: "deck-1", entries: [0, 2, 7, 1], sideboard: [] }],
    });
    expect([...(decoded.get("deck-1")?.main ?? [])]).toEqual([["card-a", 2]]);
  });

  it("drops a trailing index with no quantity behind it", () => {
    const decoded = decodeMetaDeckCardIndex({
      cards: ["card-a", "card-b"],
      decks: [{ deckId: "deck-1", entries: [0, 2, 1], sideboard: [] }],
    });
    expect([...(decoded.get("deck-1")?.main ?? [])]).toEqual([["card-a", 2]]);
  });

  it("keeps a deck the archive holds no cards of", () => {
    const decoded = decodeMetaDeckCardIndex({
      cards: [],
      decks: [{ deckId: "deck-1", entries: [], sideboard: [] }],
    });
    expect(decoded.get("deck-1")?.main.size).toBe(0);
    expect(decoded.get("deck-1")?.side.size).toBe(0);
  });

  it("returns an empty map for an empty index", () => {
    expect(decodeMetaDeckCardIndex({ cards: [], decks: [] }).size).toBe(0);
  });
});

describe("ownedCountsByCardId", () => {
  const printings = new Map([
    ["card-a", [{ printingId: "print-a1" }, { printingId: "print-a2" }]],
    ["card-b", [{ printingId: "print-b1" }]],
  ]);

  it("sums a card's copies across its printings", () => {
    const owned = ownedCountsByCardId({ "print-a1": 2, "print-a2": 1 }, printings);
    expect(owned.get("card-a")).toBe(3);
  });

  it("leaves out a card the reader owns none of", () => {
    const owned = ownedCountsByCardId({ "print-a1": 1 }, printings);
    expect(owned.has("card-b")).toBe(false);
  });

  it("ignores a printing outside the catalog", () => {
    const owned = ownedCountsByCardId({ "print-unknown": 5 }, printings);
    expect(owned.size).toBe(0);
  });
});

describe("metaDeckCosts", () => {
  const decks = new Map([
    [
      "deck-1",
      {
        main: new Map([
          ["card-a", 3],
          ["card-b", 1],
        ]),
        side: new Map([["card-a", 2]]),
      },
    ],
  ]);
  const prices = new Map([
    ["card-a", 2],
    ["card-b", 10],
  ]);

  it("prices the main deck alone by default", () => {
    const costs = metaDeckCosts(decks, { includeSideboard: false, prices });
    expect(costs.get("deck-1")).toEqual({
      needed: 4,
      owned: undefined,
      value: 16,
      toComplete: undefined,
      unpriced: 0,
      unpricedMissing: 0,
    });
  });

  it("adds the sideboard's copies to the same card", () => {
    const costs = metaDeckCosts(decks, { includeSideboard: true, prices });
    expect(costs.get("deck-1")?.needed).toBe(6);
    expect(costs.get("deck-1")?.value).toBe(20);
  });

  it("prices only the copies the reader lacks", () => {
    const costs = metaDeckCosts(decks, {
      includeSideboard: false,
      prices,
      ownedByCardId: new Map([["card-a", 2]]),
    });
    expect(costs.get("deck-1")).toEqual({
      needed: 4,
      owned: 2,
      value: 16,
      toComplete: 12,
      unpriced: 0,
      unpricedMissing: 0,
    });
  });

  it("caps a card's owned copies at what the list plays", () => {
    const costs = metaDeckCosts(decks, {
      includeSideboard: false,
      prices,
      ownedByCardId: new Map([["card-a", 9]]),
    });
    expect(costs.get("deck-1")?.owned).toBe(3);
    expect(costs.get("deck-1")?.toComplete).toBe(10);
  });

  it("caps against the combined quantity once the sideboard counts", () => {
    const costs = metaDeckCosts(decks, {
      includeSideboard: true,
      prices,
      ownedByCardId: new Map([["card-a", 9]]),
    });
    expect(costs.get("deck-1")?.owned).toBe(5);
  });

  it("values the priced cards and counts the unpriced ones", () => {
    const costs = metaDeckCosts(decks, {
      includeSideboard: false,
      prices: new Map([["card-a", 2]]),
      ownedByCardId: new Map(),
    });
    expect(costs.get("deck-1")).toMatchObject({
      value: 6,
      unpriced: 1,
      toComplete: 6,
      unpricedMissing: 1,
    });
  });

  it("still costs a completion when the unpriced card is one the reader owns", () => {
    const costs = metaDeckCosts(decks, {
      includeSideboard: false,
      prices: new Map([["card-a", 2]]),
      ownedByCardId: new Map([["card-b", 1]]),
    });
    expect(costs.get("deck-1")).toMatchObject({ value: 6, unpriced: 1, toComplete: 6 });
    expect(costs.get("deck-1")?.unpricedMissing).toBe(0);
  });

  it("costs nothing to complete a list the reader already holds", () => {
    const costs = metaDeckCosts(decks, {
      includeSideboard: false,
      prices,
      ownedByCardId: new Map([
        ["card-a", 3],
        ["card-b", 1],
      ]),
    });
    expect(costs.get("deck-1")?.toComplete).toBe(0);
  });

  it("reports a list the archive holds no cards of as needing nothing", () => {
    const costs = metaDeckCosts(new Map([["deck-1", { main: new Map(), side: new Map() }]]), {
      includeSideboard: true,
      prices,
      ownedByCardId: new Map(),
    });
    expect(costs.get("deck-1")).toEqual({
      needed: 0,
      owned: 0,
      value: 0,
      toComplete: 0,
      unpriced: 0,
      unpricedMissing: 0,
    });
  });

  it("gives a partial list no value, ownership or cost to complete", () => {
    const costs = metaDeckCosts(decks, {
      includeSideboard: false,
      prices,
      ownedByCardId: new Map([
        ["card-a", 3],
        ["card-b", 1],
      ]),
      partialDeckIds: new Set(["deck-1"]),
    });
    expect(costs.get("deck-1")).toEqual({
      needed: 4,
      owned: undefined,
      value: undefined,
      toComplete: undefined,
      unpriced: 0,
      unpricedMissing: 0,
    });
  });

  it("still prices a full list when another deck is partial", () => {
    const costs = metaDeckCosts(decks, {
      includeSideboard: false,
      prices,
      partialDeckIds: new Set(["deck-2"]),
    });
    expect(costs.get("deck-1")?.value).toBe(16);
  });
});

describe("partialListDeckIds", () => {
  it("collects the decks of partial lists only", () => {
    expect(
      partialListDeckIds([
        { deckId: "deck-1", listStatus: "partial" },
        { deckId: "deck-2", listStatus: "full" },
        { deckId: null, listStatus: "none" },
      ]),
    ).toEqual(new Set(["deck-1"]));
  });

  it("is empty for no rows", () => {
    expect(partialListDeckIds([])).toEqual(new Set());
  });
});

describe("metaCardOwnershipBand", () => {
  const printings = new Map([
    ["card-a", [{ printingId: "p-en" }, { printingId: "p-foil" }, { printingId: "p-fr" }]],
  ]);

  it("fills the displayed printing first, then the card's other printings", () => {
    const band = metaCardOwnershipBand(
      { cardId: "card-a", quantity: 3 },
      "p-en",
      { "p-en": 1, "p-fr": 1 },
      printings,
    );
    expect(band).toEqual({ exact: 1, other: 1, borrowed: 0, locked: 0, missing: 1 });
  });

  it("counts a printing with the card on both sides once", () => {
    const band = metaCardOwnershipBand(
      { cardId: "buff", quantity: 3 },
      "p-pair",
      { "p-pair": 1 },
      new Map([["buff", [{ printingId: "p-pair" }, { printingId: "p-pair" }]]]),
    );
    expect(band).toEqual({ exact: 1, other: 0, borrowed: 0, locked: 0, missing: 2 });
  });

  it("caps at the quantity the list plays", () => {
    const band = metaCardOwnershipBand(
      { cardId: "card-a", quantity: 2 },
      "p-en",
      { "p-en": 5 },
      printings,
    );
    expect(band).toEqual({ exact: 2, other: 0, borrowed: 0, locked: 0, missing: 0 });
  });

  it("counts every owned copy as another printing when the thumbnail has none", () => {
    const band = metaCardOwnershipBand(
      { cardId: "card-a", quantity: 3 },
      null,
      { "p-en": 1, "p-foil": 1 },
      printings,
    );
    expect(band).toEqual({ exact: 0, other: 2, borrowed: 0, locked: 0, missing: 1 });
  });
});
