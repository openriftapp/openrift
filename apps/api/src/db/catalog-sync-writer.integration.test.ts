import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PRINTINGS } from "../test/fixtures/constants.js";
import { createDbContext } from "../test/integration-context.js";
import { writePricesSync } from "./catalog-sync-writer.js";
import type { PricesSync } from "./catalog-sync.js";
import { SYNC_GROUP_ID } from "./catalog-sync.js";

const ctx = createDbContext("a0000000-0033-4000-a000-000000000001");

describe.skipIf(!ctx)("writePricesSync (integration)", () => {
  const { db } = ctx!;
  const refreshGroupId = 80_303;
  const refreshExternalId = 915_301;
  const syncExternalId = 915_302;
  const staleExternalId = 915_303;
  const printing = PRINTINGS["OGN-007:common:normal::EN"];
  const today = new Date("2126-05-01T00:00:00Z");
  let refreshProductId: string;

  const syncRows: PricesSync = {
    groups: [{ marketplace: "cardmarket", groupId: SYNC_GROUP_ID, name: "Synced prices" }],
    products: [
      {
        skuKey: `cardmarket::${refreshExternalId}::normal::`,
        marketplace: "cardmarket",
        externalId: refreshExternalId,
        groupId: SYNC_GROUP_ID,
        productName: "Sync Writer Refresh-Owned",
        finish: "normal",
        language: null,
      },
      {
        skuKey: `cardmarket::${syncExternalId}::normal::`,
        marketplace: "cardmarket",
        externalId: syncExternalId,
        groupId: SYNC_GROUP_ID,
        productName: "Sync Writer Owned",
        finish: "normal",
        language: null,
      },
    ],
    variants: [
      { skuKey: `cardmarket::${refreshExternalId}::normal::`, printingId: printing.id },
      { skuKey: `cardmarket::${syncExternalId}::normal::`, printingId: printing.id },
    ],
    prices: [
      { skuKey: `cardmarket::${refreshExternalId}::normal::`, recordedAt: today, lowCents: 111 },
      { skuKey: `cardmarket::${syncExternalId}::normal::`, recordedAt: today, lowCents: 222 },
    ],
  };

  async function productsByExternalId(externalId: number) {
    return db
      .selectFrom("marketplaceProducts")
      .select(["id", "groupId", "productName"])
      .where("marketplace", "=", "cardmarket")
      .where("externalId", "=", externalId)
      .execute();
  }

  async function lowCentsOf(productId: string) {
    const rows = await db
      .selectFrom("marketplaceProductPrices")
      .select(["recordedAt", "lowCents"])
      .where("marketplaceProductId", "=", productId)
      .orderBy("recordedAt")
      .execute();
    return rows.map((row) => row.lowCents);
  }

  beforeAll(async () => {
    await db
      .insertInto("marketplaceGroups")
      .values({ marketplace: "cardmarket", groupId: refreshGroupId, name: "Sync Writer Refresh" })
      .onConflict((oc) => oc.columns(["marketplace", "groupId"]).doNothing())
      .execute();
    const refreshProduct = await db
      .insertInto("marketplaceProducts")
      .values({
        marketplace: "cardmarket",
        groupId: refreshGroupId,
        externalId: refreshExternalId,
        productName: "Refresh Product",
        finish: "normal",
        language: null,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    refreshProductId = refreshProduct.id;
    await db
      .insertInto("marketplaceProductPrices")
      .values([
        {
          marketplaceProductId: refreshProductId,
          recordedAt: new Date("2126-04-01T00:00:00Z"),
          lowCents: 500,
        },
        {
          marketplaceProductId: refreshProductId,
          recordedAt: new Date("2126-04-02T00:00:00Z"),
          lowCents: 510,
        },
      ])
      .execute();
    await db
      .insertInto("marketplaceGroups")
      .values({ marketplace: "cardmarket", groupId: SYNC_GROUP_ID, name: "Synced prices" })
      .onConflict((oc) => oc.columns(["marketplace", "groupId"]).doNothing())
      .execute();
    await db
      .insertInto("marketplaceProducts")
      .values({
        marketplace: "cardmarket",
        groupId: SYNC_GROUP_ID,
        externalId: staleExternalId,
        productName: "Stale Sync Product",
        finish: "normal",
        language: null,
      })
      .execute();
  });

  afterAll(async () => {
    const ids = [refreshExternalId, syncExternalId, staleExternalId];
    const products = await db
      .selectFrom("marketplaceProducts")
      .select("id")
      .where("marketplace", "=", "cardmarket")
      .where("externalId", "in", ids)
      .execute();
    const productIds = products.map((product) => product.id);
    if (productIds.length > 0) {
      await db
        .deleteFrom("marketplaceProductVariants")
        .where("marketplaceProductId", "in", productIds)
        .execute();
      await db.deleteFrom("marketplaceProducts").where("id", "in", productIds).execute();
    }
    await db
      .deleteFrom("marketplaceGroups")
      .where("marketplace", "=", "cardmarket")
      .where("groupId", "=", refreshGroupId)
      .execute();
  });

  it("leaves a product the regular refresh holds and its price history untouched", async () => {
    const result = await writePricesSync(db, syncRows);

    expect(result.skippedProducts).toBe(1);
    expect(await productsByExternalId(refreshExternalId)).toEqual([
      { id: refreshProductId, groupId: refreshGroupId, productName: "Refresh Product" },
    ]);
    expect(await lowCentsOf(refreshProductId)).toEqual([500, 510]);
    const refreshVariants = await db
      .selectFrom("marketplaceProductVariants")
      .select("printingId")
      .where("marketplaceProductId", "=", refreshProductId)
      .execute();
    expect(refreshVariants).toEqual([]);
  });

  it("writes its own product and deletes its own stale one", async () => {
    const [owned] = await productsByExternalId(syncExternalId);
    expect(owned?.groupId).toBe(SYNC_GROUP_ID);
    expect(await lowCentsOf(owned!.id)).toEqual([222]);
    expect(await productsByExternalId(staleExternalId)).toEqual([]);
  });

  it("writes the same rows again on a second run", async () => {
    const [before] = await productsByExternalId(syncExternalId);

    const result = await writePricesSync(db, syncRows);

    const [after] = await productsByExternalId(syncExternalId);
    expect(result.skippedProducts).toBe(1);
    expect(after?.id).toBe(before?.id);
    expect(await lowCentsOf(after!.id)).toEqual([222]);
    expect(await lowCentsOf(refreshProductId)).toEqual([500, 510]);
  });
});
