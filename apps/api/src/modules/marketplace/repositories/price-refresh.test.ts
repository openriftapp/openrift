import { describe, expect, it } from "vitest";

import { createMockDb } from "../../../test/mock-db.js";
import { createRecordingDb } from "../../../test/recording-db.js";
import { priceRefreshRepo } from "./price-refresh.js";

describe("priceRefreshRepo", () => {
  it("allPrintingsForPriceMatch returns printings", async () => {
    const db = createMockDb([{ id: "p-1" }]);
    expect(await priceRefreshRepo(db).allPrintingsForPriceMatch()).toHaveLength(1);
  });

  it("loadIgnoredKeys returns LoadedIgnoredKeys with productIds and variantKeys", async () => {
    const db = createMockDb([{ externalId: 123, finish: "normal", language: "EN" }]);
    const result = await priceRefreshRepo(db).loadIgnoredKeys("tcgplayer");
    expect(result.productIds).toBeInstanceOf(Set);
    expect(result.variantKeys).toBeInstanceOf(Set);
    expect(result.productIds.has(123)).toBe(true);
    expect(result.variantKeys.has("123::normal::EN")).toBe(true);
  });

  it("loadIgnoredKeys returns empty sets when no ignored rows", async () => {
    const db = createMockDb([]);
    const result = await priceRefreshRepo(db).loadIgnoredKeys("tcgplayer");
    expect(result.productIds.size).toBe(0);
    expect(result.variantKeys.size).toBe(0);
  });

  it("upsertProductsForMarketplace returns product IDs per SKU", async () => {
    const db = createMockDb([{ id: "mp-1", externalId: 123, finish: "normal", language: "EN" }]);
    const result = await priceRefreshRepo(db).upsertProductsForMarketplace("tcgplayer", [
      {
        externalId: 123,
        finish: "normal",
        language: "EN",
        groupId: 1,
        productName: "Card",
      },
    ]);
    expect(result).toEqual([{ id: "mp-1", externalId: 123, finish: "normal", language: "EN" }]);
  });

  it("upsertProductsForMarketplace is a no-op for empty input", async () => {
    const db = createMockDb([]);
    expect(await priceRefreshRepo(db).upsertProductsForMarketplace("tcgplayer", [])).toEqual([]);
  });

  it("upsertProductPrices splits the returned rows into inserted and updated", async () => {
    const db = createMockDb([{ inserted: true }, { inserted: false }, { inserted: true }]);
    expect(
      await priceRefreshRepo(db).upsertProductPrices([
        {
          marketplaceProductId: "mp-1",
          recordedAt: new Date(),
          marketCents: 1500,
          lowCents: null,
          zeroLowCents: null,
          midCents: null,
          highCents: null,
          trendCents: null,
          avg1Cents: null,
          avg7Cents: null,
          avg30Cents: null,
        },
      ]),
    ).toEqual({ inserted: 2, updated: 1 });
  });

  it("existingSourcesByMarketplaces returns sources with finish + language", async () => {
    const db = createMockDb([
      {
        marketplace: "tcgplayer",
        externalId: 123,
        printingId: "p-1",
        finish: "normal",
        language: "EN",
        groupId: 1,
        productName: "Card",
      },
    ]);
    expect(await priceRefreshRepo(db).existingSourcesByMarketplaces(["tcgplayer"])).toHaveLength(1);
  });

  it("batchInsertProductVariants throws when a marketplace's product is missing", async () => {
    const { db, setRows } = createRecordingDb();
    setRows([
      { id: "p-tcg", marketplace: "tcgplayer", externalId: 42, finish: "normal", language: null },
    ]);

    await expect(
      priceRefreshRepo(db).batchInsertProductVariants([
        {
          marketplace: "cardmarket",
          externalId: 42,
          groupId: 7,
          productName: "Card",
          printingId: "pr-cm",
          finish: "normal",
          language: null,
        },
      ]),
    ).rejects.toThrow("missing product id for cardmarket 42 normal/NULL");
  });
});
