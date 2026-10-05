import { describe, expect, it, vi } from "vitest";

import type { MarketplaceConfig, StagingRow } from "./marketplace-configs.js";
import { buildStagedRowMapping } from "./marketplace-mapping-shared.js";

function makeConfig(priceRows: Record<string, unknown>[]) {
  return {
    priceQuery: vi.fn(async () => priceRows),
    mapPriceRow: vi.fn((row: { productName: string }) => ({ productName: row.productName })),
    mapStagingPrices: vi.fn(() => ({ marketCents: 100 })),
  } as unknown as MarketplaceConfig;
}

const stagingRow = {
  externalId: 12,
  groupId: 3,
  productName: "Jinx",
  finish: "normal",
  language: null,
  recordedAt: new Date("2026-09-01T00:00:00.000Z"),
} as unknown as StagingRow;

describe("buildStagedRowMapping", () => {
  it("skips the price query when nothing is mapped", async () => {
    const config = makeConfig([]);
    const { mappedProductInfo } = await buildStagedRowMapping(
      config,
      new Set(),
      new Map(),
      new Map(),
      new Map(),
    );
    expect(mappedProductInfo.size).toBe(0);
    expect(config.priceQuery).not.toHaveBeenCalled();
  });

  it("keys mapped prices by the full SKU tuple and keeps the first row per key", async () => {
    const config = makeConfig([
      { printingId: "p1", externalId: 12, finish: "foil", language: null, productName: "first" },
      { printingId: "p1", externalId: 12, finish: "foil", language: null, productName: "second" },
      { printingId: "p1", externalId: 12, finish: "normal", language: "EN", productName: "third" },
    ]);
    const { mappedProductInfo } = await buildStagedRowMapping(
      config,
      new Set(["p1"]),
      new Map(),
      new Map(),
      new Map(),
    );
    expect([...mappedProductInfo.keys()]).toEqual(["p1::12::foil::", "p1::12::normal::EN"]);
    expect(mappedProductInfo.get("p1::12::foil::")).toEqual({ productName: "first" });
  });

  it("maps a staged row with group details and a fallback group name", async () => {
    const config = makeConfig([]);
    const { mapStagedRow } = await buildStagedRowMapping(
      config,
      new Set(),
      new Map(),
      new Map([[3, "basic" as const]]),
      new Map([[3, "ogn"]]),
    );
    expect(mapStagedRow(stagingRow, { isOverride: true })).toEqual({
      externalId: 12,
      productName: "Jinx",
      finish: "normal",
      language: null,
      marketCents: 100,
      recordedAt: "2026-09-01T00:00:00.000Z",
      isOverride: true,
      groupId: 3,
      groupName: "Group #3",
      groupKind: "basic",
      groupSetSlug: "ogn",
    });
    expect(mapStagedRow(stagingRow)).not.toHaveProperty("isOverride");
  });
});
