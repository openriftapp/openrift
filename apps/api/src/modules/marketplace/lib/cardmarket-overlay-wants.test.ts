import { describe, expect, it } from "vitest";

import type { ListEntryRow } from "../../lists/repositories/lists-shared.js";
import { overlayWantsFromEntries } from "./cardmarket-overlay-wants.js";

const BASE = {
  listId: "lst-1",
  source: "manual" as const,
  ruleQuantity: 0,
  cardName: "Fizz, Trickster",
  tradeOverride: { pricePref: null, priceAbsoluteCents: null, tradeType: null },
};

const PRINTING_FIELDS = {
  setId: "set-1",
  rarity: "common" as const,
  finish: "normal" as const,
  shortCode: "OGN-007",
  language: "EN",
  imageId: null,
};

describe("overlayWantsFromEntries", () => {
  it("maps a card row to a card target", () => {
    const row: ListEntryRow = { ...BASE, id: "le-1", kind: "card", cardId: "card-1", quantity: 3 };

    expect(overlayWantsFromEntries([row])).toEqual([
      { cardId: "card-1", printingId: null, quantity: 3 },
    ]);
  });

  it("maps a printing row to a printing target", () => {
    const row: ListEntryRow = {
      ...BASE,
      ...PRINTING_FIELDS,
      id: "le-2",
      kind: "printing",
      printingId: "pr-1",
      quantity: 2,
    };

    expect(overlayWantsFromEntries([row])).toEqual([
      { cardId: null, printingId: "pr-1", quantity: 2 },
    ]);
  });

  it("maps a copy row through the copy's printing", () => {
    const row: ListEntryRow = {
      ...BASE,
      ...PRINTING_FIELDS,
      id: "le-3",
      kind: "copy",
      copyId: "cp-1",
      printingId: "pr-2",
      collectionId: "col-1",
      reserved: false,
      onLoan: false,
      quantity: 1,
    };

    expect(overlayWantsFromEntries([row])).toEqual([
      { cardId: null, printingId: "pr-2", quantity: 1 },
    ]);
  });

  it("keeps a rule-only row, which has no entry id", () => {
    const row: ListEntryRow = {
      ...BASE,
      id: null,
      source: "rule",
      ruleQuantity: 2,
      kind: "card",
      cardId: "card-9",
      quantity: 2,
    };

    expect(overlayWantsFromEntries([row])).toEqual([
      { cardId: "card-9", printingId: null, quantity: 2 },
    ]);
  });

  it("keeps one want per row so two lists wanting a card add up", () => {
    const first: ListEntryRow = {
      ...BASE,
      id: "le-1",
      kind: "card",
      cardId: "card-1",
      quantity: 2,
    };
    const second: ListEntryRow = {
      ...BASE,
      listId: "lst-2",
      id: "le-4",
      kind: "card",
      cardId: "card-1",
      quantity: 3,
    };

    expect(overlayWantsFromEntries([first, second])).toEqual([
      { cardId: "card-1", printingId: null, quantity: 2 },
      { cardId: "card-1", printingId: null, quantity: 3 },
    ]);
  });

  it("returns nothing for an empty list", () => {
    expect(overlayWantsFromEntries([])).toEqual([]);
  });
});
