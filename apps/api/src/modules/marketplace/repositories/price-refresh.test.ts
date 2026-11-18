import { describe, expect, it } from "vitest";

import { createMockDb } from "../../../test/mock-db.js";
import { createRecordingDb } from "../../../test/recording-db.js";
import { priceRefreshRepo } from "./price-refresh.js";

describe("priceRefreshRepo", () => {
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

  it("upsertProductsForMarketplace issues no query for empty input", async () => {
    const recorded = createRecordingDb();
    expect(
      await priceRefreshRepo(recorded.db).upsertProductsForMarketplace("tcgplayer", []),
    ).toEqual([]);
    expect(recorded.queries).toEqual([]);
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
