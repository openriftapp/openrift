import { searchCards } from "@openrift/shared/card-search";
import { describe, expect, it } from "vitest";

import { stubPrinting } from "@/test/factories";

import { cardLookupIndex, printingLookupIndex, shownPrintingHits } from "./card-lookup-rows";

const first = stubPrinting({
  printingId: "p-1",
  cardId: "card-1",
  shortCode: "OGN-001",
  publicCode: "OGN-001/298",
  card: { name: "Fireball" },
});
const second = stubPrinting({
  printingId: "p-2",
  cardId: "card-1",
  shortCode: "SFD-201",
  publicCode: "SFD-201/221",
  printedName: "Feuerball",
  card: { name: "Fireball" },
});
const other = stubPrinting({ printingId: "p-3", cardId: "card-2", card: { name: "Shield" } });

describe("printingLookupIndex", () => {
  it("builds one row per printing, found by its own code only", () => {
    const index = printingLookupIndex([first, second]);
    expect(searchCards(index, "SFD-201", 5).map((row) => row.printing)).toEqual([second]);
  });

  it("finds a row by its own printed name", () => {
    const index = printingLookupIndex([first, second]);
    expect(searchCards(index, "feuerball", 5).map((row) => row.id)).toEqual(["p-2"]);
  });
});

describe("cardLookupIndex", () => {
  const index = cardLookupIndex([first, second, other]);

  it("keeps the first printing of each card as its representative and lists all of them", () => {
    const [row] = searchCards(index, "fireball", 5);
    expect(row).toMatchObject({ id: "card-1", printing: first, printings: [first, second] });
  });

  it("finds a card by the code and printed name of a later printing", () => {
    expect(searchCards(index, "SFD-201", 5).map((row) => row.id)).toEqual(["card-1"]);
    expect(searchCards(index, "feuerball", 5).map((row) => row.id)).toEqual(["card-1"]);
  });

  it("accepts any iterable", () => {
    expect(cardLookupIndex(new Set([other])).entries).toHaveLength(1);
  });
});

describe("shownPrintingHits", () => {
  const card = { name: "Royal Guard" };
  const en = stubPrinting({ printingId: "en", cardId: "guard", language: "EN", card });
  const fr = stubPrinting({
    printingId: "fr",
    cardId: "guard",
    language: "FR",
    shortCode: "OGN-210",
    printedName: "Garde royal",
    card,
  });
  const index = printingLookupIndex([en, fr]);
  const shownByCardId = new Map([["guard", [en]]]);

  it("shows the card's shown printing for a hit on a hidden one", () => {
    expect(shownPrintingHits(searchCards(index, "garde royal", 5), shownByCardId)).toEqual([en]);
    expect(shownPrintingHits(searchCards(index, "OGN-210", 5), shownByCardId)).toEqual([en]);
  });

  it("keeps a hit on a shown printing as it is", () => {
    expect(shownPrintingHits(searchCards(index, "royal guard", 5), shownByCardId)).toEqual([en]);
  });
});
