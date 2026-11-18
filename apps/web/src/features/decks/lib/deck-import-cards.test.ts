import { describe, expect, it } from "vitest";

import {
  archivedCopyCards,
  dedupeMatchedEntries,
  importOverflowMessage,
  mergeMatchedEntries,
} from "./deck-import-cards";

function entry(
  cardId: string,
  zone: string,
  quantity: number,
  preferredPrintingId: string | null = null,
) {
  return {
    zone: zone as never,
    entry: { quantity },
    resolvedCard: { cardId, displayName: `Name ${cardId}`, preferredPrintingId },
  };
}

describe("dedupeMatchedEntries", () => {
  it("returns an empty array for no entries", () => {
    expect(dedupeMatchedEntries([])).toEqual([]);
  });

  it("sums quantities for the same card, zone, and printing", () => {
    const result = dedupeMatchedEntries([entry("card-a", "main", 2), entry("card-a", "main", 1)]);
    expect(result).toEqual([
      { cardId: "card-a", zone: "main", quantity: 3, preferredPrintingId: null },
    ]);
  });

  it("keeps distinct rows per zone and per preferred printing", () => {
    const result = dedupeMatchedEntries([
      entry("card-a", "main", 2),
      entry("card-a", "sideboard", 1),
      entry("card-a", "main", 1, "printing-1"),
    ]);
    expect(result).toHaveLength(3);
    expect(result).toContainEqual({
      cardId: "card-a",
      zone: "main",
      quantity: 2,
      preferredPrintingId: null,
    });
    expect(result).toContainEqual({
      cardId: "card-a",
      zone: "sideboard",
      quantity: 1,
      preferredPrintingId: null,
    });
    expect(result).toContainEqual({
      cardId: "card-a",
      zone: "main",
      quantity: 1,
      preferredPrintingId: "printing-1",
    });
  });

  it("skips entries without a resolved card", () => {
    const unresolved = { zone: "main" as never, entry: { quantity: 4 }, resolvedCard: null };
    const result = dedupeMatchedEntries([unresolved, entry("card-b", "main", 1)]);
    expect(result).toEqual([
      { cardId: "card-b", zone: "main", quantity: 1, preferredPrintingId: null },
    ]);
  });
});

describe("mergeMatchedEntries overflow", () => {
  it("names the cards that lost copies and totals them", () => {
    const { cards, overflow } = mergeMatchedEntries([
      entry("card-a", "main", 60),
      entry("card-a", "main", 42),
      entry("card-b", "main", 100),
      entry("card-c", "main", 3),
    ]);
    expect(cards.map((card) => card.quantity)).toEqual([99, 99, 3]);
    expect(overflow).toEqual([
      { name: "Name card-a", count: 3 },
      { name: "Name card-b", count: 1 },
    ]);
    expect(importOverflowMessage(overflow)).toBe(
      "4 copies over the 99 limit were left out: Name card-a, Name card-b",
    );
  });

  it("gives no message when nothing was cut", () => {
    expect(importOverflowMessage(mergeMatchedEntries([entry("card-a", "main", 99)]).overflow)).toBe(
      null,
    );
  });
});

describe("archivedCopyCards", () => {
  const named = (
    cardId: string,
    zone: string,
    quantity: number,
    cardName = "Blazing Scorcher",
  ) => ({
    cardId,
    zone: zone as never,
    quantity,
    preferredPrintingId: null,
    cardName,
    cardTypes: ["unit" as const],
    tags: [],
  });

  it("merges repeated archived rows into one under the cap and names the cut copies", () => {
    const result = archivedCopyCards([named("a", "main", 60), named("a", "main", 50)], []);
    expect(result.cards).toEqual([
      { cardId: "a", zone: "main", quantity: 99, preferredPrintingId: null },
    ]);
    expect(result.overflow).toEqual([{ name: "Blazing Scorcher", count: 11 }]);
  });

  it("skips a guessed card whose default-art row the list already holds", () => {
    const result = archivedCopyCards([named("a", "main", 3)], [named("a", "main", 1)]);
    expect(result.cards).toEqual([
      { cardId: "a", zone: "main", quantity: 3, preferredPrintingId: null },
    ]);
    expect(result.overflow).toEqual([]);
  });

  it("adds a guessed card the list lacks", () => {
    const result = archivedCopyCards([named("a", "main", 3)], [named("yi", "champion", 1)]);
    expect(result.cards.map((card) => card.cardId)).toEqual(["a", "yi"]);
  });
});
