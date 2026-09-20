import type { DeckCardWithDeckResponse } from "@openrift/shared/types/api/deck";
import { describe, expect, it } from "vitest";

import {
  deckCardsByDeck,
  deckCardsForDeck,
  dropCardsOfMissingDecks,
  mergeDeckCardsDelta,
} from "@/features/decks/lib/deck-card-rows";

function row(deckId: string, cardId: string): DeckCardWithDeckResponse {
  return { deckId, cardId, zone: "main", quantity: 2, preferredPrintingId: `p-${cardId}` };
}

describe("deckCardsForDeck", () => {
  it("keeps only the requested deck's rows and drops the deck id", () => {
    const rows = [row("d1", "c1"), row("d2", "c2"), row("d1", "c3")];

    expect(deckCardsForDeck(rows, "d1")).toEqual([
      { cardId: "c1", zone: "main", quantity: 2, preferredPrintingId: "p-c1" },
      { cardId: "c3", zone: "main", quantity: 2, preferredPrintingId: "p-c3" },
    ]);
  });

  it("returns an empty list for missing rows or an unknown deck", () => {
    expect(deckCardsForDeck(undefined, "d1")).toEqual([]);
    expect(deckCardsForDeck([row("d1", "c1")], "d9")).toEqual([]);
  });
});

describe("mergeDeckCardsDelta", () => {
  it("replaces a changed deck's cards and leaves other decks alone", () => {
    const previous = [row("d1", "c1"), row("d1", "c2"), row("d2", "c3")];

    const merged = mergeDeckCardsDelta(previous, [row("d1", "c9")], ["d1"]);

    expect(merged.map((card) => [card.deckId, card.cardId])).toEqual([
      ["d2", "c3"],
      ["d1", "c9"],
    ]);
  });

  it("drops the cards of a deck emptied since the watermark", () => {
    const previous = [row("d1", "c1"), row("d2", "c2")];

    const merged = mergeDeckCardsDelta(previous, [], ["d1"]);

    expect(merged.map((card) => card.deckId)).toEqual(["d2"]);
  });

  it("takes a deck it has never seen from the changed rows", () => {
    const merged = mergeDeckCardsDelta([row("d1", "c1")], [row("d2", "c2")], ["d2"]);

    expect(merged.map((card) => card.deckId).toSorted()).toEqual(["d1", "d2"]);
  });
});

describe("dropCardsOfMissingDecks", () => {
  it("drops the cards of a deck that is gone and keeps the rest", () => {
    const rows = [row("d1", "c1"), row("d2", "c2"), row("d1", "c3")];

    const kept = dropCardsOfMissingDecks(rows, new Set(["d1"]));

    expect(kept.map((card) => [card.deckId, card.cardId])).toEqual([
      ["d1", "c1"],
      ["d1", "c3"],
    ]);
  });

  it("keeps nothing when no deck is live", () => {
    expect(dropCardsOfMissingDecks([row("d1", "c1")], new Set())).toEqual([]);
  });
});

describe("deckCardsByDeck", () => {
  it("groups the wanted decks and leaves the others out", () => {
    const rows = [row("d1", "c1"), row("d2", "c2"), row("d3", "c3")];

    expect(deckCardsByDeck(rows, ["d1", "d2"])).toEqual({
      d1: [{ cardId: "c1", zone: "main", quantity: 2, preferredPrintingId: "p-c1" }],
      d2: [{ cardId: "c2", zone: "main", quantity: 2, preferredPrintingId: "p-c2" }],
    });
  });

  it("gives a wanted deck with no rows an empty list", () => {
    expect(deckCardsByDeck([row("d1", "c1")], ["d1", "d2"]).d2).toEqual([]);
  });
});
