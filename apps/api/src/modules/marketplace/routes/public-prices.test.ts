import { cardtraderSnapshotSchema } from "@openrift/shared/contracts/prices";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Repos } from "../../../deps.js";
import { registerRouterForTest } from "../../../test/mount-router.js";
import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import { pricesRouter } from "./public-prices";

const mockCatalogRepo = {
  getPrintingById: vi.fn(() => Promise.resolve(undefined as object | undefined)),
};

const mockMarketplaceRepo = {
  latestPrices: vi.fn(() => Promise.resolve([] as object[])),
  latestPricesForPrintings: vi.fn((..._args: string[][]) => Promise.resolve([] as object[])),
  sourcesForPrinting: vi.fn(() => Promise.resolve([] as object[])),
  sourcesForPrintings: vi.fn((..._args: Parameters<Repos["marketplace"]["sourcesForPrintings"]>) =>
    Promise.resolve([] as object[]),
  ),
  sourcesForAllPrintings: vi.fn(() => Promise.resolve([] as object[])),
  snapshots: vi.fn((..._args: Parameters<Repos["marketplace"]["snapshots"]>) =>
    Promise.resolve([] as object[]),
  ),
};

// Mounted the way production does: one OpenAPIHandler behind a catch-all.
const app = new Hono<{ Variables: Variables }>();
app.use("*", async (c, next) => {
  c.set("repos", {
    catalog: mockCatalogRepo,
    marketplace: mockMarketplaceRepo,
  } as never);
  await next();
});
registerRouterForTest(app, pricesRouter);

const PRINTING_A = "a0000000-0001-4000-a000-000000000001";
const PRINTING_B = "a0000000-0001-4000-a000-000000000002";

const dbPrice = {
  printingId: PRINTING_A,
  marketplace: "tcgplayer",
  marketCents: 275,
  recordedAt: new Date("2026-03-01"),
};

const dbPriceFoil = {
  printingId: PRINTING_B,
  marketplace: "tcgplayer",
  marketCents: 800,
  recordedAt: new Date("2026-03-01"),
};

const dbPrinting = { id: PRINTING_A, slug: PRINTING_A };

const dbMarketplaceSource = {
  variantId: "ms-tcg-1",
  externalId: 12_345,
  marketplace: "tcgplayer",
  printingId: PRINTING_A,
  language: "EN",
};
const dbMarketplaceSourceCM = {
  variantId: "ms-cm-1",
  externalId: 67_890,
  marketplace: "cardmarket",
  printingId: PRINTING_A,
  language: "FR",
};

const dbSnapshot = {
  id: "snap-1",
  variantId: "ms-tcg-1",
  recordedAt: new Date("2026-03-01"),
  marketCents: 275,
  lowCents: 200,
};

const UNAVAILABLE = { available: false, productId: null, url: null };

describe("GET /api/v1/prices", () => {
  beforeEach(() => {
    mockMarketplaceRepo.latestPrices.mockReset().mockResolvedValue([dbPrice, dbPriceFoil]);
  });

  it("returns 200 with PricesResponse structure", async () => {
    const res = await app.request("/api/v1/prices");
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.prices).toBeDefined();
    expect(json.currencies.tcgplayer).toBe("USD");
  });

  it("emits market_cents as integer cents, one entry per printing", async () => {
    const res = await app.request("/api/v1/prices");
    const json = await readJson(res);
    expect(json.prices[PRINTING_A]).toEqual({ tcgplayer: 275 });
    expect(json.prices[PRINTING_B]).toEqual({ tcgplayer: 800 });
  });

  it("groups multiple marketplaces under the same printing", async () => {
    mockMarketplaceRepo.latestPrices.mockResolvedValue([
      { printingId: PRINTING_A, marketplace: "tcgplayer", marketCents: 100 },
      { printingId: PRINTING_A, marketplace: "cardmarket", marketCents: 200 },
      { printingId: PRINTING_A, marketplace: "cardtrader", marketCents: 300 },
    ]);
    const res = await app.request("/api/v1/prices");
    const json = await readJson(res);
    expect(json.prices[PRINTING_A]).toEqual({ tcgplayer: 100, cardmarket: 200, cardtrader: 300 });
  });

  it("returns empty prices when no rows exist", async () => {
    mockMarketplaceRepo.latestPrices.mockResolvedValue([]);
    const res = await app.request("/api/v1/prices");
    const json = await readJson(res);
    expect(json.prices).toEqual({});
  });
});

describe("GET /api/v1/prices/:printingId", () => {
  beforeEach(() => {
    mockCatalogRepo.getPrintingById.mockReset().mockResolvedValue(dbPrinting);
    mockMarketplaceRepo.latestPricesForPrintings.mockReset().mockResolvedValue([dbPrice]);
    mockMarketplaceRepo.sourcesForPrinting
      .mockReset()
      .mockResolvedValue([dbMarketplaceSource, dbMarketplaceSourceCM]);
    mockMarketplaceRepo.sourcesForPrintings
      .mockReset()
      .mockResolvedValue([dbMarketplaceSource, dbMarketplaceSourceCM]);
    mockMarketplaceRepo.snapshots.mockReset().mockResolvedValue([dbSnapshot]);
  });

  it("returns every marketplace with its link, currency, price and snapshots", async () => {
    const res = await app.request(`/api/v1/prices/${PRINTING_A}`);
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.tcgplayer).toEqual({
      available: true,
      productId: 12_345,
      url: "https://partner.tcgplayer.com/openrift?u=https%3A%2F%2Fwww.tcgplayer.com%2Fproduct%2F12345",
      currency: "USD",
      price: 275,
      snapshots: [{ date: "2026-03-01", market: 275, low: 200 }],
    });
    expect(json.cardmarket).toMatchObject({
      available: true,
      productId: 67_890,
      url: "https://www.cardmarket.com/en/Riftbound/Products?idProduct=67890&language=2",
      currency: "EUR",
      price: null,
    });
    expect(json.cardtrader).toEqual({
      ...UNAVAILABLE,
      currency: "EUR",
      price: null,
      snapshots: [],
    });
    expect(json.cardnexus).toEqual({ ...UNAVAILABLE, currency: "EUR", price: null, snapshots: [] });
  });

  it("returns 404 for an unknown printing", async () => {
    mockCatalogRepo.getPrintingById.mockResolvedValue(undefined);
    const res = await app.request("/api/v1/prices/a0000000-0001-4000-a000-ffffffffffff");
    expect(res.status).toBe(404);
    const json = await readJson(res);
    expect(json).toMatchObject({ defined: true, code: "NOT_FOUND" });
    expect(mockMarketplaceRepo.snapshots).not.toHaveBeenCalled();
  });

  it("returns unavailable marketplaces when no sources exist", async () => {
    mockMarketplaceRepo.sourcesForPrinting.mockResolvedValue([]);
    mockMarketplaceRepo.sourcesForPrintings.mockResolvedValue([]);
    mockMarketplaceRepo.snapshots.mockResolvedValue([]);
    const res = await app.request(`/api/v1/prices/${PRINTING_A}`);
    const json = await readJson(res);
    expect(json.tcgplayer).toMatchObject({ ...UNAVAILABLE, price: 275, snapshots: [] });
    expect(json.cardmarket).toMatchObject({ ...UNAVAILABLE, snapshots: [] });
  });

  it("defaults to a 30d cutoff and uses null for 'all'", async () => {
    await app.request(`/api/v1/prices/${PRINTING_A}`);
    expect(mockMarketplaceRepo.snapshots.mock.calls[0]?.[1]).toBeInstanceOf(Date);
    mockMarketplaceRepo.snapshots.mockClear();
    await app.request(`/api/v1/prices/${PRINTING_A}?range=all`);
    expect(mockMarketplaceRepo.snapshots.mock.calls[0]?.[1]).toBeNull();
  });

  it("accepts the 7d and 90d ranges and rejects anything else with 400", async () => {
    const week = await app.request(`/api/v1/prices/${PRINTING_A}?range=7d`);
    const quarter = await app.request(`/api/v1/prices/${PRINTING_A}?range=90d`);
    expect([week.status, quarter.status]).toEqual([200, 200]);
    const res = await app.request(`/api/v1/prices/${PRINTING_A}?range=invalid`);
    expect(res.status).toBe(400);
    const json = await readJson(res);
    expect(json.data.issues).toEqual([{ path: "range", message: expect.any(String) }]);
  });

  it("rejects a non-UUID printingId with 400 and no schema internals", async () => {
    const res = await app.request("/api/v1/prices/not-a-uuid");
    expect(res.status).toBe(400);
    const json = await readJson(res);
    expect(json.data.issues).toEqual([{ path: "printingId", message: "Invalid UUID" }]);
    expect(JSON.stringify(json)).not.toContain("pattern");
  });

  it("returns cardtrader snapshots with zeroLow and low, skipping days with neither", async () => {
    const ctSource = {
      variantId: "ms-ct-1",
      externalId: 99_999,
      marketplace: "cardtrader",
      printingId: PRINTING_A,
      language: "EN",
    };
    mockMarketplaceRepo.sourcesForPrinting.mockResolvedValue([ctSource]);
    mockMarketplaceRepo.sourcesForPrintings.mockResolvedValue([ctSource]);
    mockMarketplaceRepo.snapshots.mockResolvedValue([
      { recordedAt: new Date("2026-03-01"), marketCents: null, zeroLowCents: null, lowCents: 150 },
      { recordedAt: new Date("2026-03-02"), marketCents: null, zeroLowCents: null, lowCents: null },
    ]);
    const res = await app.request(`/api/v1/prices/${PRINTING_A}`);
    const json = await readJson(res);
    expect(json.cardtrader).toMatchObject({
      available: true,
      productId: 99_999,
      url: "https://www.cardtrader.com/en/cards/99999?share_code=openrift",
      snapshots: [{ date: "2026-03-01", zeroLow: null, low: 150 }],
    });
  });

  it("returns CardNexus snapshots as the low listing and skips days without one", async () => {
    const cnSource = {
      variantId: "ms-cn-1",
      externalId: 151_160,
      marketplace: "cardnexus",
      printingId: PRINTING_A,
      language: "EN",
    };
    mockMarketplaceRepo.sourcesForPrinting.mockResolvedValue([cnSource]);
    mockMarketplaceRepo.sourcesForPrintings.mockResolvedValue([cnSource]);
    mockMarketplaceRepo.snapshots.mockResolvedValue([
      { recordedAt: new Date("2026-10-01"), marketCents: null, lowCents: 37 },
      { recordedAt: new Date("2026-10-02"), marketCents: null, lowCents: null },
    ]);
    const res = await app.request(`/api/v1/prices/${PRINTING_A}`);
    const json = await readJson(res);
    expect(json.cardnexus).toEqual({
      available: true,
      productId: 151_160,
      url: "https://af.cardnexus.link/7018965/cn/151160",
      currency: "EUR",
      price: null,
      snapshots: [{ date: "2026-10-01", low: 37 }],
    });
  });

  it("returns Cardmarket's avg as market and its low listing as low, falling back to market", async () => {
    mockMarketplaceRepo.snapshots.mockImplementation(async (variantId: string) =>
      variantId === "ms-cm-1"
        ? [
            { recordedAt: new Date("2026-03-02"), marketCents: 300, lowCents: 150 },
            { recordedAt: new Date("2026-03-03"), marketCents: 300, lowCents: null },
            { recordedAt: new Date("2026-03-04"), marketCents: null, lowCents: null },
          ]
        : [dbSnapshot],
    );
    const res = await app.request(`/api/v1/prices/${PRINTING_A}`);
    const json = await readJson(res);
    expect(json.cardmarket.snapshots).toEqual([
      { date: "2026-03-02", market: 300, low: 150 },
      { date: "2026-03-03", market: 300, low: null },
    ]);
  });
});

describe("GET /api/v1/prices/links", () => {
  beforeEach(() => {
    mockMarketplaceRepo.sourcesForPrintings.mockReset().mockResolvedValue([]);
    mockMarketplaceRepo.sourcesForAllPrintings.mockReset().mockResolvedValue([]);
  });

  it("rejects an empty printings query with 400", async () => {
    const res = await app.request("/api/v1/prices/links?printings=");
    expect(res.status).toBe(400);
  });

  it("rejects invalid uuid with 400", async () => {
    const res = await app.request("/api/v1/prices/links?printings=not-a-uuid");
    expect(res.status).toBe(400);
  });

  it("returns unavailable slots for a requested printing with no sources", async () => {
    const res = await app.request(`/api/v1/prices/links?printings=${PRINTING_A}`);
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.links[PRINTING_A]).toEqual({
      tcgplayer: UNAVAILABLE,
      cardmarket: UNAVAILABLE,
      cardtrader: UNAVAILABLE,
      cardnexus: UNAVAILABLE,
    });
    expect(mockMarketplaceRepo.sourcesForAllPrintings).not.toHaveBeenCalled();
  });

  it("maps sources to per-marketplace productId and referral url", async () => {
    mockMarketplaceRepo.sourcesForPrintings.mockResolvedValue([
      { printingId: PRINTING_A, externalId: 12_345, marketplace: "tcgplayer", language: "EN" },
      { printingId: PRINTING_A, externalId: 67_890, marketplace: "cardmarket", language: "FR" },
      { printingId: PRINTING_B, externalId: 11_111, marketplace: "cardtrader", language: "EN" },
      { printingId: PRINTING_B, externalId: 22_222, marketplace: "cardnexus", language: "EN" },
    ]);
    const res = await app.request(`/api/v1/prices/links?printings=${PRINTING_A},${PRINTING_B}`);
    const json = await readJson(res);
    expect(json.links[PRINTING_A].tcgplayer).toEqual({
      available: true,
      productId: 12_345,
      url: "https://partner.tcgplayer.com/openrift?u=https%3A%2F%2Fwww.tcgplayer.com%2Fproduct%2F12345",
    });
    expect(json.links[PRINTING_A].cardmarket).toEqual({
      available: true,
      productId: 67_890,
      url: "https://www.cardmarket.com/en/Riftbound/Products?idProduct=67890&language=2",
    });
    expect(json.links[PRINTING_B].cardtrader).toEqual({
      available: true,
      productId: 11_111,
      url: "https://www.cardtrader.com/en/cards/11111?share_code=openrift",
    });
    expect(json.links[PRINTING_B].cardnexus.url).toBe("https://af.cardnexus.link/7018965/cn/22222");
    expect(json.links[PRINTING_B].tcgplayer).toEqual(UNAVAILABLE);
  });

  it("dedupes repeated printing ids before querying", async () => {
    await app.request(`/api/v1/prices/links?printings=${PRINTING_A},${PRINTING_A},${PRINTING_B}`);
    const ids = mockMarketplaceRepo.sourcesForPrintings.mock.calls[0]?.[0] as string[] | undefined;
    expect(ids).toEqual([PRINTING_A, PRINTING_B]);
  });

  it("returns every printing with a source when printings is omitted", async () => {
    mockMarketplaceRepo.sourcesForAllPrintings.mockResolvedValue([
      { printingId: PRINTING_B, externalId: 11_111, marketplace: "cardtrader", language: "EN" },
    ]);
    const res = await app.request("/api/v1/prices/links");
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(Object.keys(json.links)).toEqual([PRINTING_B]);
    expect(json.links[PRINTING_B].cardtrader.productId).toBe(11_111);
    expect(json.links[PRINTING_B].tcgplayer).toEqual(UNAVAILABLE);
    expect(mockMarketplaceRepo.sourcesForPrintings).not.toHaveBeenCalled();
  });
});

describe("price schemas", () => {
  it("keeps the CardTrader snapshot to its own fields", () => {
    expect(Object.keys(cardtraderSnapshotSchema.shape).toSorted()).toEqual([
      "date",
      "low",
      "zeroLow",
    ]);
  });
});
