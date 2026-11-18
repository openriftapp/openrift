import type { Logger } from "@openrift/shared/logger";
import { describe, expect, it } from "vitest";

import type { Repos } from "../../../../deps";
import type { StagingRow } from "../../lib/marketplace-configs.js";
import { upsertPriceData } from "./upsert";

function makeMockLogger(): { log: Logger; messages: string[] } {
  const messages: string[] = [];
  const log = {
    info: (msg: string) => messages.push(msg),
  } as unknown as Logger;
  return { log, messages };
}

const noop = () => {};
const noopLogger = { info: noop, warn: noop, error: noop, debug: noop } as unknown as Logger;

function makeStagingRow(
  extId: number,
  finish: string,
  prices: Partial<StagingRow> = {},
): StagingRow {
  return {
    externalId: extId,
    groupId: 1001,
    productName: "Test Product",
    finish,
    language: "EN",
    recordedAt: new Date("2026-03-10T00:00:00Z"),
    marketCents: 100,
    lowCents: null,
    zeroLowCents: null,
    midCents: null,
    highCents: null,
    trendCents: null,
    avg1Cents: null,
    avg7Cents: null,
    avg30Cents: null,
    ...prices,
  };
}

function makeMockRepo(opts: {
  countResult?: number;
  outcomeOf?: (productId: string) => "inserted" | "updated" | "unchanged";
}) {
  const countResult = opts.countResult ?? 0;
  const upsertedPrices: { marketplaceProductId: string; recordedAt: Date }[] = [];

  const repo = {
    upsertProductsForMarketplace: async (
      _marketplace: string,
      skus: {
        externalId: number;
        finish: string;
        language: string | null;
        groupId: number;
        productName: string;
      }[],
    ) =>
      skus.map((s) => ({
        id: `mp-${s.externalId}-${s.finish}-${s.language ?? ""}`,
        externalId: s.externalId,
        finish: s.finish,
        language: s.language,
      })),
    countStaging: async () => countResult,
    upsertProductPrices: async (batch: { marketplaceProductId: string; recordedAt: Date }[]) => {
      for (const row of batch) {
        upsertedPrices.push({
          marketplaceProductId: row.marketplaceProductId,
          recordedAt: row.recordedAt,
        });
      }
      const outcomes = batch.map((row) => opts.outcomeOf?.(row.marketplaceProductId));
      return {
        inserted: outcomes.filter((o) => o === "inserted").length,
        updated: outcomes.filter((o) => o === "updated").length,
      };
    },
    upsertStaging: async () => 0,
  } as unknown as Repos["priceRefresh"];

  return {
    repo,
    upsertedPrices,
  };
}

describe("upsertPriceData", () => {
  it("counts new, updated and unchanged rows from the upsert's own result", async () => {
    const outcomes: Record<string, "inserted" | "updated" | "unchanged"> = {
      "mp-1-normal-EN": "inserted",
      "mp-2-normal-EN": "updated",
      "mp-3-normal-EN": "unchanged",
    };
    const { repo } = makeMockRepo({ outcomeOf: (id) => outcomes[id] ?? "unchanged" });
    const staging = [1, 2, 3].map((id) => makeStagingRow(id, "normal"));

    const counts = await upsertPriceData(repo, noopLogger, "cardmarket", staging);

    expect(counts.prices).toEqual({ total: 3, new: 1, updated: 1, unchanged: 1 });
  });

  it("writes one price row per staging SKU", async () => {
    const { log, messages } = makeMockLogger();
    const { repo, upsertedPrices } = makeMockRepo({});
    const staging = [makeStagingRow(1001, "normal")];

    const counts = await upsertPriceData(repo, log, "cardmarket", staging);

    expect(counts.prices.total).toBe(1);
    expect(upsertedPrices).toHaveLength(1);
    expect(upsertedPrices[0]!.marketplaceProductId).toBe("mp-1001-normal-EN");
    expect(messages.some((m) => m.includes("1 price rows"))).toBe(true);
  });

  it("keeps separate price rows for different recordedAt on the same SKU", async () => {
    const { repo, upsertedPrices } = makeMockRepo({});
    const row1 = makeStagingRow(4001, "normal");
    const row2 = {
      ...makeStagingRow(4001, "normal"),
      recordedAt: new Date("2026-03-11T00:00:00Z"),
    };

    const counts = await upsertPriceData(repo, noopLogger, "cardmarket", [row1, row2]);

    expect(counts.prices.total).toBe(2);
    expect(upsertedPrices).toHaveLength(2);
    expect(upsertedPrices[0]!.marketplaceProductId).toBe(upsertedPrices[1]!.marketplaceProductId);
  });

  it("does not log a price-count message when there are no prices to write", async () => {
    const { log, messages } = makeMockLogger();
    const { repo } = makeMockRepo({});

    await upsertPriceData(repo, log, "cardmarket", []);

    expect(messages.some((m) => m.includes("price rows"))).toBe(false);
  });

  it.each([
    {
      name: "different finishes on the same external_id",
      marketplace: "cardmarket" as const,
      staging: [makeStagingRow(3001, "normal"), makeStagingRow(3001, "foil")],
    },
    {
      name: "language=null SKUs (CM/TCG) and language='EN'",
      marketplace: "cardmarket" as const,
      staging: [
        { ...makeStagingRow(12_345, "normal"), language: null },
        { ...makeStagingRow(12_345, "normal"), language: "EN" },
      ],
    },
    {
      name: "per-language SKUs on a marketplace that exposes language (CT)",
      marketplace: "cardtrader" as const,
      staging: [
        { ...makeStagingRow(54_321, "normal"), language: "EN" },
        { ...makeStagingRow(54_321, "normal"), language: "SC" },
      ],
    },
  ])("keeps separate products and price rows for $name", async ({ marketplace, staging }) => {
    const { repo, upsertedPrices } = makeMockRepo({});

    const counts = await upsertPriceData(repo, noopLogger, marketplace, staging);

    expect(counts.prices.total).toBe(2);
    const productIds = new Set(upsertedPrices.map((r) => r.marketplaceProductId));
    expect(productIds.size).toBe(2);
  });
});
