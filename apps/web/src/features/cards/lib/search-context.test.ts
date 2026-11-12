import { filterCards } from "@openrift/shared/filters";
import type { InitResponse } from "@openrift/shared/types/api/init";
import { EMPTY_CARD_FILTERS } from "@openrift/shared/types/search";
import { describe, expect, it } from "vitest";

import { stubPrinting } from "@/test/factories";

import { ssrCardSearchContext } from "./search-context";

const INIT = {
  enums: { rarities: [], domains: [], languages: [], formats: [] },
  keywords: {},
} as unknown as Pick<InitResponse, "enums" | "keywords">;

describe("ssrCardSearchContext", () => {
  it("builds the vocabulary and keyword map once per catalog and init", () => {
    const catalog = { allPrintings: [stubPrinting()], sets: [{ slug: "ogn", name: "Origins" }] };
    const first = ssrCardSearchContext(catalog, INIT, {}, ["EN"]);
    const second = ssrCardSearchContext(catalog, INIT, { getPrice: () => 1 }, ["EN"]);
    expect(second.vocabulary).toBe(first.vocabulary);
    expect(second.keywordReverseMap).toBe(first.keywordReverseMap);
    expect(second.getPrice).toBeDefined();
  });

  it("searches only the printings in the client's preload languages", () => {
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
    const catalog = { allPrintings: [en, fr], sets: [] };
    const ids = (search: string, preloadLangs: string[]) =>
      filterCards(
        catalog.allPrintings,
        { ...EMPTY_CARD_FILTERS, search, languages: ["EN"] },
        ssrCardSearchContext(catalog, INIT, {}, preloadLangs),
      ).map((printing) => printing.printingId);

    expect(ssrCardSearchContext(catalog, INIT, {}, ["EN"]).searchablePrintings).toEqual([en]);
    expect(ids("garde royal", ["EN"])).toEqual([]);
    expect(ids("OGN-210", ["EN"])).toEqual([]);
    expect(ids("garde royal", ["EN", "FR"])).toEqual(["en"]);
    expect(ids("OGN-210", ["EN", "FR"])).toEqual(["en"]);
  });
});
