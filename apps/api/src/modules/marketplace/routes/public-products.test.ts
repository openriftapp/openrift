import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { registerRouterForTest } from "../../../test/mount-router.js";
import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import { productsRouter } from "./public-products";

const PRODUCT_ID = "a0000000-0001-4000-a000-000000000001";
const CARD_ID = "c0000000-0001-4000-a000-000000000001";
const SET_ID = "s0000000-0001-4000-a000-000000000001";
const PRINTING_ID = "p0000000-0001-4000-a000-000000000001";

const mockCatalogRepo = {
  printingsByIds: vi.fn(),
  printingImagesByPrintingIds: vi.fn(),
  cardsByIds: vi.fn(),
  cardBansByCardIds: vi.fn(),
  cardErrataByCardIds: vi.fn(),
  sets: vi.fn(),
  markersList: vi.fn(),
  variantSiblingRowsByCardIds: vi.fn(),
};
const mockProductsRepo = {
  getBySlugWithCounts: vi.fn(),
  contents: vi.fn(),
  coverCards: vi.fn(),
};
const mockDistributionChannelsRepo = { listForPrintingIds: vi.fn(), listAll: vi.fn() };
const mockPrintingCitationsRepo = { listForPrintingIds: vi.fn() };

const app = new Hono<{ Variables: Variables }>();
app.use("*", async (c, next) => {
  c.set("repos", {
    catalog: mockCatalogRepo,
    products: mockProductsRepo,
    distributionChannels: mockDistributionChannelsRepo,
    printingCitations: mockPrintingCitationsRepo,
  } as any);
  await next();
});
registerRouterForTest(app, productsRouter);

const dbCard = {
  id: CARD_ID,
  slug: "jinx-rebel",
  name: "Jinx, Rebel",
  type: "Unit",
  types: ["Unit"],
  superTypes: ["Champion"],
  domains: ["Chaos"],
  tokenCardIds: [],
  might: 5,
  energy: 5,
  power: null,
  keywords: [],
  tags: [],
  mightBonus: null,
  maxCopiesOverride: null,
  additionalLegendCount: null,
};

const dbPrinting = {
  printingId: PRINTING_ID,
  side: 1,
  faceId: PRINTING_ID,
  otherSide: null,
  shortCode: "OGN-202",
  setId: SET_ID,
  rarity: "Epic",
  artVariant: "normal",
  isSigned: false,
  isOvernumbered: false,
  markerSlugs: ["promo"],
  finish: "foil",
  size: "standard",
  artist: "Kudos Productions",
  publicCode: "OGN-202/298",
  printedRulesText: null,
  printedEffectText: null,
  flavorText: null,
  printedName: null,
  printedYear: 2025,
  language: "EN",
  comment: null,
  canonicalRank: 1,
  cardId: CARD_ID,
  fallbackArtMode: "auto",
  fallbackImageId: null,
  hasFoilTwin: false,
};

const siblingRow = {
  cardId: CARD_ID,
  shortCode: "OGN-202",
  language: "EN",
  rarity: "Epic",
  finish: "foil",
  isSigned: false,
  markerSlugs: ["promo"],
  otherSide: null,
};

describe("GET /api/v1/products/:slug", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockProductsRepo.getBySlugWithCounts.mockResolvedValue({
      id: PRODUCT_ID,
      slug: "jinx-starter",
      name: "Jinx Starter",
      description: null,
      setId: null,
      setSlug: null,
      setName: null,
      printingCount: 1,
      cardTotal: 2,
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    });
    mockProductsRepo.contents.mockResolvedValue([{ printingId: PRINTING_ID, quantity: 2 }]);
    mockProductsRepo.coverCards.mockResolvedValue([]);
    mockCatalogRepo.printingsByIds.mockResolvedValue([dbPrinting]);
    mockCatalogRepo.printingImagesByPrintingIds.mockResolvedValue([]);
    mockCatalogRepo.cardsByIds.mockResolvedValue([dbCard]);
    mockCatalogRepo.cardBansByCardIds.mockResolvedValue([]);
    mockCatalogRepo.cardErrataByCardIds.mockResolvedValue([]);
    mockCatalogRepo.sets.mockResolvedValue([]);
    mockCatalogRepo.markersList.mockResolvedValue([
      { id: "m1", slug: "promo", label: "Promo", description: null },
    ]);
    mockCatalogRepo.variantSiblingRowsByCardIds.mockResolvedValue([
      siblingRow,
      { ...siblingRow, language: "FR", finish: "normal", markerSlugs: [] },
    ]);
    mockDistributionChannelsRepo.listForPrintingIds.mockResolvedValue([]);
    mockDistributionChannelsRepo.listAll.mockResolvedValue([]);
    mockPrintingCitationsRepo.listForPrintingIds.mockResolvedValue([]);
  });

  it("sends the variant summary of every printing of the product's cards", async () => {
    const res = await app.request("/api/v1/products/jinx-starter");
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(mockCatalogRepo.variantSiblingRowsByCardIds).toHaveBeenCalledWith([CARD_ID]);
    expect(json.variantSiblings).toEqual({
      [CARD_ID]: {
        languages: ["EN", "FR"],
        rarities: ["Epic"],
        finishes: ["foil", "normal"],
        markerSlugs: [["promo"], []],
        signed: [false],
        otherSides: [],
      },
    });
    expect(json.printings.map((p: { printingId: string }) => p.printingId)).toEqual([PRINTING_ID]);
  });

  it("returns 404 for an unknown product", async () => {
    mockProductsRepo.getBySlugWithCounts.mockResolvedValue(undefined);
    const res = await app.request("/api/v1/products/missing-product");
    expect(res.status).toBe(404);
  });
});
