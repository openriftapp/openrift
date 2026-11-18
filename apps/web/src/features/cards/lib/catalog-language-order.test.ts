import { describe, expect, it } from "vitest";

import { buildCardsResult } from "@/features/cards/lib/catalog-queries";
import { stubPrinting } from "@/test/factories";

import { catalogLanguageOrder } from "./catalog-language-order";

const EN = stubPrinting({ cardId: "card-1", language: "EN", canonicalRank: 0 });
const DE = stubPrinting({ cardId: "card-1", language: "DE", canonicalRank: 1 });
const catalog = buildCardsResult({}, [EN, DE], []);

describe("catalogLanguageOrder", () => {
  it("puts the listed languages first, in every lookup that is ordered", () => {
    const sorted = catalogLanguageOrder(["DE", "EN"])(catalog);

    expect(sorted.allPrintings).toEqual([DE, EN]);
    expect(sorted.printingsByCardId.get("card-1")).toEqual([DE, EN]);
    expect(sorted.printingsById).toBe(catalog.printingsById);
  });

  it("returns one order per language list and one sorted catalogue per catalogue", () => {
    const languages = ["DE", "EN"];
    const order = catalogLanguageOrder(languages);

    expect(catalogLanguageOrder(languages)).toBe(order);
    expect(order(catalog)).toBe(order(catalog));
  });

  it("sorts again for a new catalogue", () => {
    const order = catalogLanguageOrder(["DE"]);
    const next = buildCardsResult({}, [EN, DE], []);

    expect(order(next)).not.toBe(order(catalog));
  });

  it("leaves the catalogue as is when no language is listed", () => {
    expect(catalogLanguageOrder([])(catalog)).toBe(catalog);
  });
});
