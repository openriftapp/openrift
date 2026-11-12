import { EMPTY_PRICE_LOOKUP } from "@openrift/shared/price-lookup";
import { testSearchContext } from "@openrift/shared/test-factories";
import { EMPTY_CARD_FILTERS } from "@openrift/shared/types/search";
import { describe, expect, it } from "vitest";

import { stubPrinting } from "@/test/factories";

import { deriveCardGrid } from "./card-grid-pipeline";

const card = { name: "Royal Guard", slug: "royal-guard" };
const en = stubPrinting({
  printingId: "en",
  cardId: "guard",
  language: "EN",
  shortCode: "OGN-010",
  publicCode: "OGN-010/298",
  card,
});
const fr = stubPrinting({
  printingId: "fr",
  cardId: "guard",
  language: "FR",
  shortCode: "OGN-210",
  publicCode: "OGN-210/298",
  printedName: "Garde royal",
  card,
});
const other = stubPrinting({
  printingId: "other",
  cardId: "other",
  language: "EN",
  shortCode: "OGN-011",
  card: { name: "Scout", slug: "scout" },
});

function shown(search: string, view: "cards" | "printings" = "cards") {
  return deriveCardGrid({
    allPrintings: [en, fr, other],
    sets: [],
    filters: { ...EMPTY_CARD_FILTERS, search, languages: ["EN"] },
    view,
    groupBy: "none",
    sortBy: "id",
    sortDir: "asc",
    context: testSearchContext(),
    prices: EMPTY_PRICE_LOOKUP,
    favoriteMarketplace: "cardtrader",
  }).sortedCards.map((printing) => printing.printingId);
}

describe("deriveCardGrid with English as the only display language", () => {
  it("finds a card by its French printed name and shows the English printing", () => {
    expect(shown("garde royal")).toEqual(["en"]);
    expect(shown("garde royal", "printings")).toEqual(["en"]);
  });

  it("finds a card by the code of its French printing", () => {
    expect(shown("OGN-210")).toEqual(["en"]);
  });
});
