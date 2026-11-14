import { describe, expect, it } from "vitest";

import { sameDeckCards, toDeckCard } from "./deck-cards.js";

function card(cardId: string, quantity: number) {
  return { cardId, zone: "main", quantity, preferredPrintingId: null as string | null };
}

describe("toDeckCard", () => {
  it("keeps only the four deck card fields of a wider row", () => {
    const row = {
      deckId: "deck-1",
      cardId: "card-1",
      zone: "main" as const,
      quantity: 4,
      preferredPrintingId: null,
    };
    expect(toDeckCard(row)).toEqual({
      cardId: "card-1",
      zone: "main",
      quantity: 4,
      preferredPrintingId: null,
    });
  });
});

describe("sameDeckCards", () => {
  it("is true for the same rows and quantities in any order", () => {
    expect(sameDeckCards([card("a", 1), card("b", 2)], [card("b", 2), card("a", 1)])).toBe(true);
  });

  it("is false when a quantity changes", () => {
    expect(sameDeckCards([card("a", 1)], [card("a", 2)])).toBe(false);
  });

  it("is false when a row moves zone with the same quantity", () => {
    const moved = { ...card("a", 1), zone: "sideboard" };
    expect(sameDeckCards([card("a", 1)], [moved])).toBe(false);
  });

  it("is false when a row changes printing", () => {
    const repinned = { ...card("a", 1), preferredPrintingId: "printing-2" };
    expect(sameDeckCards([card("a", 1)], [repinned])).toBe(false);
  });

  it("is false when a row is added or removed", () => {
    expect(sameDeckCards([card("a", 1)], [card("a", 1), card("b", 1)])).toBe(false);
    expect(sameDeckCards([card("a", 1), card("b", 1)], [card("a", 1)])).toBe(false);
  });

  it("counts repeated lines instead of summing them", () => {
    expect(sameDeckCards([card("a", 1), card("a", 1)], [card("a", 1), card("a", 1)])).toBe(true);
    expect(sameDeckCards([card("a", 1), card("a", 2)], [card("a", 2), card("a", 2)])).toBe(false);
  });
});
