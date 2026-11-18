import { describe, expect, it } from "vitest";

import {
  deckCardKey,
  MAX_DECK_CARD_QUANTITY,
  mergeDeckCards,
  sameDeckCards,
  toDeckCard,
} from "./deck-cards.js";

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

describe("deckCardKey", () => {
  it("separates lines by card, zone and preferred printing, not by quantity", () => {
    expect(deckCardKey(card("card-1", 2))).toBe(deckCardKey(card("card-1", 3)));
    expect(deckCardKey(card("card-1", 2))).not.toBe(
      deckCardKey({ ...card("card-1", 2), zone: "sideboard" }),
    );
    expect(deckCardKey(card("card-1", 2))).not.toBe(
      deckCardKey({ ...card("card-1", 2), preferredPrintingId: "printing-1" }),
    );
  });
});

describe("mergeDeckCards", () => {
  it("sums repeated lines of one key and keeps first-seen order", () => {
    const merged = mergeDeckCards([card("card-1", 2), card("card-2", 1), card("card-1", 1)]);
    expect(merged).toEqual([card("card-1", 3), card("card-2", 1)]);
  });

  it("stops a summed quantity at the per-row cap", () => {
    expect(mergeDeckCards([card("card-1", 60), card("card-1", 60)])).toEqual([
      card("card-1", MAX_DECK_CARD_QUANTITY),
    ]);
  });

  it("caps a single line above the per-row cap", () => {
    expect(mergeDeckCards([card("card-1", 150)])).toEqual([card("card-1", MAX_DECK_CARD_QUANTITY)]);
  });

  it("does not mutate the input lines", () => {
    const first = card("card-1", 2);
    mergeDeckCards([first, card("card-1", 1)]);
    expect(first.quantity).toBe(2);
  });

  it("keeps a printing-specific line apart from the default-art line of the same card", () => {
    const pinned = { ...card("card-1", 1), preferredPrintingId: "printing-1" };
    expect(mergeDeckCards([card("card-1", 2), pinned])).toEqual([card("card-1", 2), pinned]);
  });
});
