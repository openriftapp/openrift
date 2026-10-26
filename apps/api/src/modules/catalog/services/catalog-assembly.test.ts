import type { CatalogResponse } from "@openrift/shared/types/api/catalog";
import { describe, expect, it } from "vitest";

import {
  catalogPrintingsExcept,
  filterCatalogByLanguages,
  parseLanguageCodes,
} from "./catalog-assembly.js";

describe("parseLanguageCodes", () => {
  it("splits, trims and uppercases the codes", () => {
    expect(parseLanguageCodes(" en , fr ")).toEqual(new Set(["EN", "FR"]));
  });

  it("drops blank entries and collapses duplicates", () => {
    expect(parseLanguageCodes("EN,,en, ,FR")).toEqual(new Set(["EN", "FR"]));
  });

  it("returns an empty set for an all-blank list", () => {
    expect(parseLanguageCodes(" , ")).toEqual(new Set());
  });
});

function fakeCatalog(): CatalogResponse {
  return {
    sets: [{ id: "OGS", slug: "OGS", name: "Original Set", releases: {}, setType: "main" }],
    cards: { "OGS-001": { name: "Fire Dragon" } },
    printings: {
      "p-en": { language: "EN" },
      "p-fr": { language: "FR" },
      "p-sc": { language: "SC" },
    },
  } as unknown as CatalogResponse;
}

describe("filterCatalogByLanguages", () => {
  it("returns the catalog untouched without langs", () => {
    const catalog = fakeCatalog();
    expect(filterCatalogByLanguages(catalog)).toBe(catalog);
  });

  it("keeps only the listed languages and everything else whole", () => {
    const variant = filterCatalogByLanguages(fakeCatalog(), new Set(["EN"]));

    expect(Object.keys(variant.printings)).toEqual(["p-en"]);
    expect(variant.cards).toEqual({ "OGS-001": { name: "Fire Dragon" } });
    expect(variant.sets).toHaveLength(1);
  });

  it("accepts several codes", () => {
    const variant = filterCatalogByLanguages(fakeCatalog(), new Set(["EN", "SC"]));

    expect(Object.keys(variant.printings).toSorted()).toEqual(["p-en", "p-sc"]);
  });

  it("matches codes case-insensitively", () => {
    const variant = filterCatalogByLanguages(
      {
        ...fakeCatalog(),
        printings: { "p-lower": { language: "en" } },
      } as unknown as CatalogResponse,
      parseLanguageCodes("En"),
    );

    expect(Object.keys(variant.printings)).toEqual(["p-lower"]);
  });

  it("an unknown code matches nothing rather than erroring", () => {
    const variant = filterCatalogByLanguages(fakeCatalog(), new Set(["XX"]));

    expect(variant.printings).toEqual({});
    expect(variant.cards).toEqual({ "OGS-001": { name: "Fire Dragon" } });
  });

  it("does not mutate the input catalog", () => {
    const catalog = fakeCatalog();
    const before = structuredClone(catalog);

    filterCatalogByLanguages(catalog, new Set(["EN"]));
    catalogPrintingsExcept(catalog, new Set(["EN"]));

    expect(catalog).toEqual(before);
  });
});

describe("catalogPrintingsExcept", () => {
  it("returns only the printings outside the codes", () => {
    const tail = catalogPrintingsExcept(fakeCatalog(), new Set(["EN"]));

    expect(Object.keys(tail)).toEqual(["printings"]);
    expect(Object.keys(tail.printings).toSorted()).toEqual(["p-fr", "p-sc"]);
  });

  it("partitions the printings exactly with the langs variant", () => {
    const langs = new Set(["EN"]);
    const head = filterCatalogByLanguages(fakeCatalog(), langs);
    const tail = catalogPrintingsExcept(fakeCatalog(), langs);

    expect([...Object.keys(head.printings), ...Object.keys(tail.printings)].toSorted()).toEqual(
      Object.keys(fakeCatalog().printings).toSorted(),
    );
  });

  it("excludes nothing for an unknown or empty code set", () => {
    expect(
      Object.keys(catalogPrintingsExcept(fakeCatalog(), new Set(["XX"])).printings),
    ).toHaveLength(3);
    expect(Object.keys(catalogPrintingsExcept(fakeCatalog(), new Set()).printings)).toHaveLength(3);
  });
});
