import type { DeckCardResponse } from "@openrift/shared/types/api/deck";
import type { ListEntryDetailResponse } from "@openrift/shared/types/api/list";
import type { Printing } from "@openrift/shared/types/catalog";
import { describe, expect, it } from "vitest";

import { stubPrinting } from "@/test/factories";

import { deckPrintingIds, listPrintingIds } from "./present-queue-sources";

function byId(...printings: Printing[]): Record<string, Printing> {
  return Object.fromEntries(printings.map((printing) => [printing.printingId, printing]));
}

function byCardId(...printings: Printing[]): Map<string, Printing[]> {
  return Map.groupBy(printings, (printing) => printing.cardId);
}

function deckCard(cardId: string, preferredPrintingId: string | null = null): DeckCardResponse {
  return { cardId, zone: "main", quantity: 1, preferredPrintingId };
}

describe("deckPrintingIds", () => {
  it("uses each card's first printing", () => {
    const first = stubPrinting({ printingId: "p1", cardId: "c1" });
    const second = stubPrinting({ printingId: "p2", cardId: "c1" });

    const ids = deckPrintingIds([deckCard("c1")], byCardId(first, second));

    expect(ids).toEqual(["p1"]);
  });

  it("honours a printing the deck pinned", () => {
    const first = stubPrinting({ printingId: "p1", cardId: "c1" });
    const promo = stubPrinting({ printingId: "p2", cardId: "c1" });

    const ids = deckPrintingIds([deckCard("c1", "p2")], byCardId(first, promo));

    expect(ids).toEqual(["p2"]);
  });

  it("falls back to the first printing when the pinned one is gone", () => {
    const first = stubPrinting({ printingId: "p1", cardId: "c1" });

    const ids = deckPrintingIds([deckCard("c1", "removed")], byCardId(first));

    expect(ids).toEqual(["p1"]);
  });

  it("collapses a playset into one stop and skips unknown cards", () => {
    const printing = stubPrinting({ printingId: "p1", cardId: "c1" });

    const ids = deckPrintingIds(
      [deckCard("c1"), deckCard("c1"), deckCard("gone")],
      byCardId(printing),
    );

    expect(ids).toEqual(["p1"]);
  });

  it("names the side of a double-sided pinned printing that shows the card", () => {
    const bird = stubPrinting({ printingId: "pair", side: 1, cardId: "bird" });
    const gold = stubPrinting({ printingId: "pair", side: 2, cardId: "gold" });

    const ids = deckPrintingIds(
      [deckCard("bird", "pair"), deckCard("gold", "pair")],
      byCardId(bird, gold),
    );

    expect(ids).toEqual(["pair", "pair:2"]);
  });

  it("returns nothing for an empty deck", () => {
    expect(deckPrintingIds([], new Map())).toEqual([]);
  });
});

describe("listPrintingIds", () => {
  const base = { id: "e1", quantity: 1, note: null } as unknown as ListEntryDetailResponse;

  it("uses the printing a printing-level entry names", () => {
    const first = stubPrinting({ printingId: "p1", cardId: "c1" });
    const promo = stubPrinting({ printingId: "p2", cardId: "c1" });
    const entry = { ...base, kind: "printing", printingId: "p2" } as ListEntryDetailResponse;

    expect(listPrintingIds([entry], byCardId(first, promo), byId(first, promo))).toEqual(["p2"]);
  });

  it("resolves a card-level entry to the card's first printing", () => {
    const first = stubPrinting({ printingId: "p1", cardId: "c1" });
    const entry = { ...base, kind: "card", cardId: "c1" } as ListEntryDetailResponse;

    expect(listPrintingIds([entry], byCardId(first), byId(first))).toEqual(["p1"]);
  });

  it("collapses repeated copies of the same printing", () => {
    const printing = stubPrinting({ printingId: "p1", cardId: "c1" });
    const copy = { ...base, kind: "copy", printingId: "p1" } as ListEntryDetailResponse;

    expect(listPrintingIds([copy, copy], byCardId(printing), byId(printing))).toEqual(["p1"]);
  });

  it("skips entries the catalog no longer knows", () => {
    const entry = { ...base, kind: "printing", printingId: "gone" } as ListEntryDetailResponse;

    expect(listPrintingIds([entry], new Map(), {})).toEqual([]);
  });

  it("returns nothing for an empty list", () => {
    expect(listPrintingIds([], new Map(), {})).toEqual([]);
  });
});
