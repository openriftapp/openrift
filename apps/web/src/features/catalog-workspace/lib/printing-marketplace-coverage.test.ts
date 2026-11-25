import type { AdminCardDetailResponse } from "@openrift/shared/types/api/admin";
import { describe, expect, it } from "vitest";

import type { CardListingRow } from "./card-listing-rows";
import { marketplaceCoverage, pickableListings } from "./printing-marketplace-coverage";

type Mapping = AdminCardDetailResponse["marketplaceMappings"][number];

function mapping(overrides: Partial<Mapping> = {}): Mapping {
  return {
    targetPrintingId: "p1",
    marketplace: "cardmarket",
    externalId: 100,
    productName: "Annie, Fiery",
    finish: "normal",
    variantLanguage: null,
    ownerPrintingId: "p1",
    ownerLanguage: "EN",
    ...overrides,
  };
}

function productIds(mappings: Mapping[], language = "EN") {
  return Object.fromEntries(
    marketplaceCoverage(mappings, "p1", language).map((row) => [
      row.marketplace,
      row.products.map((product) => product.externalId),
    ]),
  );
}

describe("marketplaceCoverage", () => {
  it("lists every marketplace, also the ones without a product", () => {
    expect(productIds([mapping()])).toEqual({
      cardtrader: [],
      tcgplayer: [],
      cardmarket: [100],
      cardnexus: [],
    });
  });

  it("keeps several products of one marketplace together", () => {
    const ids = productIds([
      mapping(),
      mapping({ externalId: 101, finish: "foil" }),
      mapping({ marketplace: "cardtrader", externalId: 7 }),
    ]);
    expect(ids.cardmarket).toEqual([100, 101]);
    expect(ids.cardtrader).toEqual([7]);
  });

  it("drops the copy a double-sided printing's second card reports", () => {
    expect(productIds([mapping(), mapping()]).cardmarket).toEqual([100]);
  });

  it("leaves out products mapped to the card's other printings", () => {
    expect(productIds([mapping({ targetPrintingId: "p2" })]).cardmarket).toEqual([]);
  });

  it("marks a marketplace that does not sell the printing's language", () => {
    const carries = (language: string) =>
      Object.fromEntries(
        marketplaceCoverage([], "p1", language).map((row) => [
          row.marketplace,
          row.carriesLanguage,
        ]),
      );
    expect(carries("EN").tcgplayer).toBe(true);
    expect(carries("ZH")).toMatchObject({ tcgplayer: false, cardmarket: true });
  });
});

describe("pickableListings", () => {
  function listing(key: string, overrides: Partial<CardListingRow> = {}): CardListingRow {
    return {
      key,
      marketplace: "cardmarket",
      product: { externalId: 1, language: null } as CardListingRow["product"],
      isAssigned: false,
      assignedPrintings: [],
      assignedPrintingIds: new Set(),
      otherAssignedPrintingIds: new Set(),
      showProduct: true,
      suggestions: [],
      suggestion: null,
      assignablePrintings: [
        { printingId: "p1", language: "FR" },
      ] as CardListingRow["assignablePrintings"],
      ...overrides,
    };
  }
  const keys = (rows: CardListingRow[]) => rows.map((row) => row.key);

  it("keeps the marketplace's listings and puts the one suggested for the printing first", () => {
    const suggestion = {
      printing: { printingId: "p1" },
      strength: "strong",
    } as CardListingRow["suggestion"];
    const rows = [
      listing("plain"),
      listing("other-marketplace", { marketplace: "cardtrader" }),
      listing("suggested", { suggestion }),
    ];
    expect(keys(pickableListings(rows, "cardmarket", "p1"))).toEqual(["suggested", "plain"]);
  });

  it("drops another language's listing only where the marketplace lists per language", () => {
    const english = { externalId: 1, language: "EN" } as CardListingRow["product"];
    const french = { externalId: 1, language: "FR" } as CardListingRow["product"];
    const rows = [
      listing("ct-en", { marketplace: "cardtrader", product: english }),
      listing("ct-fr", { marketplace: "cardtrader", product: french }),
      listing("cm-en", { product: english }),
    ];
    expect(keys(pickableListings(rows, "cardtrader", "p1"))).toEqual(["ct-fr"]);
    expect(keys(pickableListings(rows, "cardmarket", "p1"))).toEqual(["cm-en"]);
  });

  it("leaves out a listing the printing cannot take", () => {
    const rows = [listing("other-printing", { assignablePrintings: [] })];
    expect(pickableListings(rows, "cardmarket", "p1")).toEqual([]);
  });
});
