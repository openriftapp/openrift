import { makeCatalogReference } from "@openrift/shared/test-factories";
import type { CatalogResponse } from "@openrift/shared/types/api/catalog";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { registerRouterForTest } from "../../../test/mount-router.js";
import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import { searchRouter } from "./public-search";

const SET_ID = "set-ogn";

function printing(cardId: string, shortCode: string) {
  return {
    cardId,
    shortCode,
    setId: SET_ID,
    rarity: "common",
    artVariant: "normal",
    isSigned: false,
    isOvernumbered: false,
    markers: [],
    distributionChannels: [],
    finish: "normal",
    size: "standard",
    images: [],
    artist: "Jane Doe",
    publicCode: shortCode,
    printedRulesText: null,
    printedEffectText: null,
    flavorText: null,
    printedName: null,
    printedYear: null,
    comment: null,
    language: "EN",
    canonicalRank: 0,
  } as CatalogResponse["printings"][string];
}

function card(name: string, energy: number) {
  return {
    slug: name.toLowerCase(),
    name,
    types: ["unit"],
    superTypes: [],
    domains: ["fury"],
    tokenCardIds: [],
    energy,
    might: 2,
    power: 1,
    keywords: [],
    tags: [],
    mightBonus: null,
    maxCopiesOverride: null,
    additionalLegendCount: null,
    errata: null,
    bans: [],
  } as CatalogResponse["cards"][string];
}

const catalog = {
  sets: [{ id: SET_ID, slug: "OGN", name: "Origins", releases: {}, setType: "main" }],
  cards: { garen: card("Garen", 5), jinx: card("Jinx", 1) },
  printings: { "garen-1": printing("garen", "OGN-001"), "jinx-1": printing("jinx", "OGN-020") },
  ...makeCatalogReference({
    enums: {
      cardTypes: [],
      superTypes: [],
      domains: [{ slug: "fury", label: "Fury", sortOrder: 0 }],
      rarities: [{ slug: "common", label: "Common", sortOrder: 0 }],
      finishes: [],
      artVariants: [],
      cardSizes: [],
      languages: [{ slug: "EN", label: "English", sortOrder: 0 }],
    },
  }),
} as CatalogResponse;

const mockMarketplace = {
  latestPrices: vi.fn(() =>
    Promise.resolve([{ printingId: "jinx-1", marketplace: "tcgplayer", marketCents: 150 }]),
  ),
};

const app = new Hono<{ Variables: Variables }>();
app.use("*", async (c, next) => {
  c.set("repos", {
    catalogResponse: { current: () => Promise.resolve({ version: "v1", value: catalog }) },
    cardBans: { listFormats: () => Promise.resolve([{ id: "standard", name: "Constructed" }]) },
    marketplace: mockMarketplace,
  } as never);
  await next();
});
registerRouterForTest(app, searchRouter);

describe("GET /api/v1/search", () => {
  beforeEach(() => {
    mockMarketplace.latestPrices.mockClear();
  });

  it("returns the matching printings with their cards and sets", async () => {
    const res = await app.request(`/api/v1/search?q=${encodeURIComponent("e<=3")}`);
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({
      total: 1,
      nextCursor: null,
      printingIds: ["jinx-1"],
      printings: { "jinx-1": catalog.printings["jinx-1"] },
      cards: { jinx: catalog.cards.jinx },
      sets: catalog.sets,
    });
    expect(mockMarketplace.latestPrices).not.toHaveBeenCalled();
  });

  it("loads prices only for a query that reads them", async () => {
    const res = await app.request(`/api/v1/search?q=${encodeURIComponent("usd<2")}`);
    const json = await readJson(res);
    expect(json.printingIds).toEqual(["jinx-1"]);
    expect(mockMarketplace.latestPrices).toHaveBeenCalledOnce();
  });

  it("answers 400 with diagnostics for a query with errors", async () => {
    const res = await app.request(`/api/v1/search?q=${encodeURIComponent("d:purple e<=x")}`);
    expect(res.status).toBe(400);
    const json = await readJson(res);
    expect(json.code).toBe("BAD_REQUEST");
    expect(json.data.diagnostics.map((diagnostic: { code: string }) => diagnostic.code)).toEqual([
      "badValue",
      "unknownValue",
    ]);
  });

  it("returns one random card", async () => {
    const res = await app.request(`/api/v1/search/random?q=${encodeURIComponent("e<=3")}`);
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.printingIds).toEqual(["jinx-1"]);
  });

  it("finds a card by exact name and answers 404 for none", async () => {
    const json = await readJson(await app.request("/api/v1/search/named?exact=Garen"));
    expect(json.printingIds).toEqual(["garen-1"]);
    const missing = await app.request("/api/v1/search/named?exact=Nobody");
    expect(missing.status).toBe(404);
  });

  it("needs exactly one of exact and fuzzy", async () => {
    const neither = await app.request("/api/v1/search/named");
    const both = await app.request("/api/v1/search/named?exact=a&fuzzy=b");
    expect(neither.status).toBe(400);
    expect(both.status).toBe(400);
  });

  it("refuses a missing query", async () => {
    const res = await app.request("/api/v1/search");
    expect(res.status).toBe(400);
  });
});
