import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { registerRouterForTest } from "../../../test/mount-router.js";
import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import { assembleCatalogResponse } from "../services/catalog-assembly.js";
import { catalogRouter } from "./public-catalog";

const mockCatalogRepo = {
  sets: vi.fn(() => Promise.resolve([] as unknown[])),
  cards: vi.fn(() => Promise.resolve([] as unknown[])),
  printings: vi.fn(() => Promise.resolve([] as unknown[])),
  printingImages: vi.fn(() => Promise.resolve([] as unknown[])),
  cardBans: vi.fn(() => Promise.resolve([])),
  cardErrata: vi.fn(() => Promise.resolve([])),
  markersList: vi.fn(() => Promise.resolve([])),
  catalogResponseVersion: vi.fn(() => Promise.resolve("test-catalog-version")),
};

const mockDistributionChannelsRepo = {
  listForPrintingIds: vi.fn(() => Promise.resolve([])),
  listAll: vi.fn(() => Promise.resolve([])),
};

const emptyEnums = {
  cardTypes: [],
  superTypes: [],
  domains: [],
  rarities: [],
  finishes: [],
  artVariants: [],
  cardSizes: [],
  deckFormats: [],
  deckZones: [],
  conditions: [],
  graders: [],
  languages: [],
  markers: [],
};

const mockEnumsRepo = {
  all: vi.fn(() => Promise.resolve(emptyEnums as Record<string, unknown[]>)),
};

const mockKeywordsRepo = {
  listAll: vi.fn(() => Promise.resolve([] as unknown[])),
  listAllTranslations: vi.fn(() => Promise.resolve([] as unknown[])),
};

const mockTagCategoriesRepo = { listAll: vi.fn(() => Promise.resolve([] as unknown[])) };
const mockTagDefinitionsRepo = { listAll: vi.fn(() => Promise.resolve([] as unknown[])) };

const mockPrintingCitationsRepo = {
  listForPrintingIds: vi.fn(() => Promise.resolve([] as Record<string, unknown>[])),
};

const app = new Hono<{ Variables: Variables }>();
app.use("*", async (c, next) => {
  const repos = {
    catalog: mockCatalogRepo,
    catalogResponse: {
      current: async () => ({
        version: await mockCatalogRepo.catalogResponseVersion(),
        value: await assembleCatalogResponse(repos as never),
      }),
    },
    distributionChannels: mockDistributionChannelsRepo,
    printingCitations: mockPrintingCitationsRepo,
    enums: mockEnumsRepo,
    keywords: mockKeywordsRepo,
    tagCategories: mockTagCategoriesRepo,
    tagDefinitions: mockTagDefinitionsRepo,
  };
  c.set("repos", repos as never);
  await next();
});
registerRouterForTest(app, catalogRouter);

const dbSet = {
  id: "OGS",
  slug: "OGS",
  name: "Original Set",
  releases: { EN: { releasedAt: "2025-10-31", precision: "day" as const } },
  setType: "main" as const,
};

const dbCard = {
  id: "OGS-001",
  slug: "OGS-001",
  name: "Fire Dragon",
  types: ["unit"],
  superTypes: ["Elite"],
  domains: ["fury"],
  tokenCardIds: [],
  might: 4,
  energy: 5,
  power: 6,
  mightBonus: 1,
  maxCopiesOverride: null,
  additionalLegendCount: null,
  keywords: ["Shield"],
  tags: ["Dragon"],
};

const dbPrintingRow = {
  printingId: "OGS-001:rare:normal:",
  side: 1,
  faceId: "OGS-001:rare:normal:",
  slug: "OGS-001:rare:normal:",
  cardId: "OGS-001",
  setId: "OGS",
  shortCode: "OGS-001",
  rarity: "rare",
  artVariant: "normal",
  isSigned: false,
  isOvernumbered: false,
  markerSlugs: [],
  finish: "normal",
  size: "standard",
  artist: "Alice",
  publicCode: "ABCD",
  printedRulesText: "A fiery beast",
  printedEffectText: "Deal 3 damage",
  flavorText: null,
  printedName: null,
  printedYear: null,
  language: "EN",
  comment: null,
  canonicalRank: 1,
};

const dbImage = {
  printingId: "OGS-001:rare:normal:",
  side: 1,
  faceId: "OGS-001:rare:normal:",
  imageId: "019d6c25-b081-74b3-a901-64da4ae012ab",
};

function seedDefaults(overrides?: {
  sets?: unknown[];
  cards?: unknown[];
  printings?: unknown[];
  printingImages?: unknown[];
}) {
  mockCatalogRepo.sets.mockResolvedValue(overrides?.sets ?? [dbSet]);
  mockCatalogRepo.cards.mockResolvedValue(overrides?.cards ?? [dbCard]);
  mockCatalogRepo.printings.mockResolvedValue(overrides?.printings ?? [dbPrintingRow]);
  mockCatalogRepo.printingImages.mockResolvedValue(overrides?.printingImages ?? [dbImage]);
  mockCatalogRepo.cardBans.mockResolvedValue([]);
  mockCatalogRepo.cardErrata.mockResolvedValue([]);
  mockCatalogRepo.markersList.mockResolvedValue([]);
  mockDistributionChannelsRepo.listForPrintingIds.mockResolvedValue([]);
  mockDistributionChannelsRepo.listAll.mockResolvedValue([]);
  mockEnumsRepo.all.mockResolvedValue(emptyEnums);
  mockKeywordsRepo.listAll.mockResolvedValue([]);
  mockKeywordsRepo.listAllTranslations.mockResolvedValue([]);
  mockTagCategoriesRepo.listAll.mockResolvedValue([]);
  mockTagDefinitionsRepo.listAll.mockResolvedValue([]);
}

describe("GET /api/v1/catalog", () => {
  beforeEach(() => {
    mockCatalogRepo.sets.mockReset();
    mockCatalogRepo.cards.mockReset();
    mockCatalogRepo.printings.mockReset();
    mockCatalogRepo.printingImages.mockReset();
    mockCatalogRepo.cardBans.mockReset();
    mockCatalogRepo.cardErrata.mockReset();
    seedDefaults();
  });

  it("returns 200 with normalized CatalogResponse structure", async () => {
    const res = await app.request("/api/v1/catalog");
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.sets).toHaveLength(1);
    expect(Object.keys(json.printings)).toHaveLength(1);
    expect(Object.keys(json.cards)).toHaveLength(1);
  });

  it("carries the catalog and its reference blocks, nothing else", async () => {
    const res = await app.request("/api/v1/catalog");
    const json = await readJson(res);
    expect(Object.keys(json).toSorted()).toEqual([
      "cards",
      "distributionChannels",
      "enums",
      "keywords",
      "markers",
      "printings",
      "sets",
      "tagCategories",
      "tagCategoryMap",
    ]);
  });

  it("names a printing's markers by slug and defines them once", async () => {
    const promo = { id: "m-1", slug: "promo", label: "Promo", description: null };
    mockCatalogRepo.markersList.mockResolvedValue([promo] as never);
    mockCatalogRepo.printings.mockResolvedValue([
      { ...dbPrintingRow, markerSlugs: ["promo", "retired"] },
    ]);
    const json = await readJson(await app.request("/api/v1/catalog"));
    expect(json.printings["OGS-001:rare:normal:"].markers).toEqual(["promo"]);
    expect(json.markers).toEqual([promo]);
  });

  it("references a printing's channels by slug with the note only when set", async () => {
    const channel = {
      id: "ch-1",
      slug: "nexus-night",
      label: "Nexus Night",
      description: null,
      kind: "event",
      parentId: null,
      childrenLabel: null,
    };
    const link = {
      printingId: "OGS-001:rare:normal:",
      channelId: channel.id,
      channelSlug: channel.slug,
      channelLabel: channel.label,
      channelDescription: null,
      channelKind: "event",
      channelParentId: null,
      channelChildrenLabel: null,
    };
    mockDistributionChannelsRepo.listAll.mockResolvedValue([channel] as never);
    mockDistributionChannelsRepo.listForPrintingIds.mockResolvedValue([
      { ...link, distributionNote: "Top 8" },
      { ...link, distributionNote: null },
    ] as never);
    const json = await readJson(await app.request("/api/v1/catalog"));
    expect(json.printings["OGS-001:rare:normal:"].distributionChannels).toEqual([
      { channel: "nexus-night", note: "Top 8" },
      { channel: "nexus-night" },
    ]);
    expect(json.distributionChannels).toEqual([channel]);
  });

  it("sends enums, keywords and tag categories without styling", async () => {
    mockEnumsRepo.all.mockResolvedValue({
      ...emptyEnums,
      domains: [{ slug: "fury", label: "Fury", sortOrder: 0, color: "#b32117", isWellKnown: true }],
    });
    mockKeywordsRepo.listAll.mockResolvedValue([
      { name: "Shield", color: "#4488ff", darkText: true, costKeyword: false, cardModifier: true },
    ]);
    mockKeywordsRepo.listAllTranslations.mockResolvedValue([
      { keywordName: "Shield", language: "FR", label: "Bouclier" },
    ]);
    mockTagCategoriesRepo.listAll.mockResolvedValue([
      { id: "tc-1", slug: "region", label: "Region", sortOrder: 0, description: null },
    ]);
    mockTagDefinitionsRepo.listAll.mockResolvedValue([
      { tag: "Ionia", categoryId: "tc-1", category: "region" },
    ]);
    const json = await readJson(await app.request("/api/v1/catalog"));
    expect(json.enums.domains).toEqual([{ slug: "fury", label: "Fury", sortOrder: 0 }]);
    expect(json.enums).not.toHaveProperty("deckZones");
    expect(json.keywords).toEqual({
      Shield: { costKeyword: false, cardModifier: true, translations: { FR: "Bouclier" } },
    });
    expect(json.tagCategories).toEqual([{ slug: "region", label: "Region", sortOrder: 0 }]);
    expect(json.tagCategoryMap).toEqual({ Ionia: "region" });
  });

  it("returns sets as { id, slug, name } objects", async () => {
    const res = await app.request("/api/v1/catalog");
    const json = await readJson(res);
    expect(json.sets[0]).toEqual({
      id: "OGS",
      slug: "OGS",
      name: "Original Set",
      releases: { EN: { releasedAt: "2025-10-31", precision: "day" } },
      setType: "main",
    });
  });

  it("returns cards keyed by card ID with non-null fields preserved", async () => {
    const res = await app.request("/api/v1/catalog");
    const json = await readJson(res);
    const card = json.cards["OGS-001"];
    expect(card).toBeDefined();
    expect(card.id).toBeUndefined();
    expect(card.name).toBe("Fire Dragon");
    expect(card.superTypes).toEqual(["Elite"]);
    expect(card.mightBonus).toBe(1);
    expect(card.might).toBe(4);
    expect(card.energy).toBe(5);
    expect(card.power).toBe(6);
  });

  it("preserves null fields and empty arrays on cards", async () => {
    seedDefaults({
      cards: [
        {
          ...dbCard,
          might: null,
          energy: null,
          power: null,
          mightBonus: null,
          maxCopiesOverride: null,
          additionalLegendCount: null,
          superTypes: [],
          keywords: [],
          tags: [],
        },
      ],
    });
    const res = await app.request("/api/v1/catalog");
    const json = await readJson(res);
    const card = json.cards["OGS-001"];
    expect(card.might).toBeNull();
    expect(card.energy).toBeNull();
    expect(card.power).toBeNull();
    expect(card.mightBonus).toBeNull();
    expect(card.errata).toBeNull();
    expect(card.superTypes).toEqual([]);
    expect(card.keywords).toEqual([]);
    expect(card.tags).toEqual([]);
    expect(card.name).toBe("Fire Dragon");
    expect(card.domains).toEqual(["fury"]);
  });

  it("preserves null fields and empty arrays on printings", async () => {
    seedDefaults({
      printings: [{ ...dbPrintingRow, printedRulesText: null, printedEffectText: null }],
      printingImages: [],
    });
    const res = await app.request("/api/v1/catalog");
    const json = await readJson(res);
    const printing = json.printings["OGS-001:rare:normal:"];
    expect(printing.printedRulesText).toBeNull();
    expect(printing.printedEffectText).toBeNull();
    expect(printing.flavorText).toBeNull();
    expect(printing.images).toEqual([]);
    expect(printing.artist).toBe("Alice");
  });

  it("maps printing fields with cardId reference instead of nested card", async () => {
    const res = await app.request("/api/v1/catalog");
    const json = await readJson(res);
    const printingId = "OGS-001:rare:normal:";
    const printing = json.printings[printingId];

    expect(printing).toBeDefined();
    expect(printing.id).toBeUndefined();
    expect(printing.shortCode).toBe("OGS-001");
    expect(printing.publicCode).toBe("ABCD");
    expect(printing.artVariant).toBe("normal");
    expect(printing.isSigned).toBe(false);
    expect(printing.markers).toEqual([]);
    expect(printing.distributionChannels).toEqual([]);
    expect(printing.finish).toBe("normal");
    expect(printing.artist).toBe("Alice");
    expect(printing.cardId).toBe("OGS-001");
    expect(printing.card).toBeUndefined();
  });

  it("forwards the image_files.id as imageId on each printing image", async () => {
    const res = await app.request("/api/v1/catalog");
    const json = await readJson(res);
    expect(json.printings["OGS-001:rare:normal:"].images).toEqual([
      { imageId: "019d6c25-b081-74b3-a901-64da4ae012ab" },
    ]);
  });

  it("passes setId through on printing", async () => {
    const res = await app.request("/api/v1/catalog");
    const json = await readJson(res);
    expect(json.printings["OGS-001:rare:normal:"].setId).toBe("OGS");
  });

  it("returns errata as null when no errata exists", async () => {
    const res = await app.request("/api/v1/catalog");
    const json = await readJson(res);
    const card = json.cards["OGS-001"];
    expect(card.errata).toBeNull();
  });

  it("does not include market price on printing (prices live on /api/v1/prices)", async () => {
    const res = await app.request("/api/v1/catalog");
    const json = await readJson(res);
    const printing = json.printings["OGS-001:rare:normal:"];
    expect(printing).toBeDefined();
    expect("marketPrice" in printing).toBe(false);
    expect("marketPrices" in printing).toBe(false);
  });

  it("returns printings from multiple sets keyed by printing id", async () => {
    const secondSet = {
      id: "S2",
      slug: "S2",
      name: "Set Two",
      releases: {},
      setType: "supplemental" as const,
    };
    const secondCard = { ...dbCard, id: "S2-001", slug: "S2-001" };
    const secondRow = {
      ...dbPrintingRow,
      printingId: "S2-001:rare:normal",
      side: 1,
      faceId: "S2-001:rare:normal",
      slug: "S2-001:rare:normal",
      cardId: "S2-001",
      shortCode: "S2-001",
      setId: "S2",
    };
    seedDefaults({
      sets: [dbSet, secondSet],
      cards: [dbCard, secondCard],
      printings: [dbPrintingRow, secondRow],
      printingImages: [],
    });

    const res = await app.request("/api/v1/catalog");
    const json = await readJson(res);
    expect(json.sets).toHaveLength(2);
    expect(Object.keys(json.printings)).toHaveLength(2);
    expect(json.printings["OGS-001:rare:normal:"]).toBeDefined();
    expect(json.printings["S2-001:rare:normal"]).toBeDefined();
    expect(Object.keys(json.cards)).toHaveLength(2);
  });

  it("returns empty printings when catalog is empty", async () => {
    seedDefaults({
      sets: [],
      cards: [],
      printings: [],
      printingImages: [],
    });
    const res = await app.request("/api/v1/catalog");
    const json = await readJson(res);
    expect(json.printings).toEqual({});
    expect(json.cards).toEqual({});
    expect(json.sets).toEqual([]);
  });

  it("accepts and ignores the ?v= cache-busting param (same body and ETag)", async () => {
    const plain = await app.request("/api/v1/catalog");
    const versioned = await app.request("/api/v1/catalog?v=some-etag-token");
    expect(versioned.status).toBe(200);
    expect(await readJson(versioned)).toEqual(await readJson(plain));
  });

  describe("language split", () => {
    const scPrintingRow = {
      ...dbPrintingRow,
      printingId: "OGS-001:rare:normal::SC",
      side: 1,
      faceId: "OGS-001:rare:normal::SC",
      slug: "OGS-001:rare:normal::SC",
      language: "SC",
    };

    function seedTwoLanguages(): void {
      seedDefaults({ printings: [dbPrintingRow, scPrintingRow], printingImages: [] });
    }

    it("langs returns only that language's printings, with the core intact", async () => {
      seedTwoLanguages();
      const res = await app.request("/api/v1/catalog?langs=EN");
      expect(res.status).toBe(200);

      const json = await readJson(res);
      expect(Object.keys(json.printings)).toEqual(["OGS-001:rare:normal:"]);
      expect(Object.keys(json.cards)).toHaveLength(1);
      expect(json.sets).toHaveLength(1);
    });

    it("langs matches case-insensitively and accepts several codes", async () => {
      seedTwoLanguages();
      const res = await app.request("/api/v1/catalog?langs=en,sc");
      const json = await readJson(res);
      expect(Object.keys(json.printings)).toHaveLength(2);
    });

    it("/catalog/printings returns only the printings outside exceptLangs", async () => {
      seedTwoLanguages();
      const res = await app.request("/api/v1/catalog/printings?exceptLangs=EN");
      expect(res.status).toBe(200);

      const json = await readJson(res);
      expect(Object.keys(json)).toEqual(["printings"]);
      expect(Object.keys(json.printings)).toEqual(["OGS-001:rare:normal::SC"]);
    });

    it("/catalog/printings carries the catalog's ETag", async () => {
      seedTwoLanguages();
      const head = await app.request("/api/v1/catalog?langs=EN");
      const tail = await app.request("/api/v1/catalog/printings?exceptLangs=EN");
      expect(tail.headers.get("etag")).toBe(head.headers.get("etag"));
    });

    it("/catalog/printings requires exceptLangs", async () => {
      seedTwoLanguages();
      const res = await app.request("/api/v1/catalog/printings");
      expect(res.status).toBe(400);
    });

    it("returns the full catalog when neither param is given", async () => {
      seedTwoLanguages();
      const res = await app.request("/api/v1/catalog");
      const json = await readJson(res);
      expect(Object.keys(json.printings)).toHaveLength(2);
      expect(Object.keys(json.cards)).toHaveLength(1);
    });

    it("an unknown language code matches nothing instead of erroring", async () => {
      seedTwoLanguages();
      const res = await app.request("/api/v1/catalog?langs=ZZ");
      expect(res.status).toBe(200);
      const json = await readJson(res);
      expect(json.printings).toEqual({});
    });
  });

  it("nests a double-sided printing's second side under side2", async () => {
    seedDefaults({
      printings: [
        dbPrintingRow,
        {
          ...dbPrintingRow,
          side: 2,
          faceId: "face-2",
          cardId: "OGS-002",
          shortCode: "OGS-002",
          canonicalRank: 2,
        },
      ],
      printingImages: [
        { printingId: "OGS-001:rare:normal:", side: 1, imageId: "front-uuid" },
        { printingId: "OGS-001:rare:normal:", side: 2, imageId: "back-uuid" },
      ],
    });
    const res = await app.request("/api/v1/catalog");
    const json = await readJson(res);
    const printing = json.printings["OGS-001:rare:normal:"];
    expect(printing.cardId).toBe("OGS-001");
    expect(printing.images).toEqual([{ imageId: "front-uuid" }]);
    expect(printing.side2).toMatchObject({
      cardId: "OGS-002",
      shortCode: "OGS-002",
      images: [{ imageId: "back-uuid" }],
    });
    expect(printing.side2).not.toHaveProperty("size");
  });

  it("handles printing with no images", async () => {
    seedDefaults({
      printingImages: [],
    });
    const res = await app.request("/api/v1/catalog");
    const json = await readJson(res);
    const printing = json.printings["OGS-001:rare:normal:"];
    expect(printing.images).toEqual([]);
  });
});
