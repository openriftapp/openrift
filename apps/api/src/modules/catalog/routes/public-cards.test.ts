import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { registerRouterForTest } from "../../../test/mount-router.js";
import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import { cardsRouter } from "./public-cards";

const mockCatalogRepo = {
  cardBySlug: vi.fn(() => Promise.resolve(undefined as Record<string, unknown> | undefined)),
  cardsByIds: vi.fn((_ids: string[]) => Promise.resolve([] as Record<string, unknown>[])),
  printingsByCardId: vi.fn(() => Promise.resolve([] as Record<string, unknown>[])),
  printingsByIds: vi.fn((_ids: string[]) => Promise.resolve([] as Record<string, unknown>[])),
  printingImagesByPrintingIds: vi.fn((_ids: string[]) =>
    Promise.resolve([] as Record<string, unknown>[]),
  ),
  cardBansByCardIds: vi.fn((_ids: string[]) => Promise.resolve([] as Record<string, unknown>[])),
  cardErrataByCardIds: vi.fn((_ids: string[]) => Promise.resolve([] as Record<string, unknown>[])),
  setsByIds: vi.fn(() => Promise.resolve([] as Record<string, unknown>[])),
  markersList: vi.fn(() => Promise.resolve([] as Record<string, unknown>[])),
  relatedCards: vi.fn(() => Promise.resolve([] as Record<string, unknown>[])),
};

const mockDistributionChannelsRepo = {
  listForPrintingIds: vi.fn(() => Promise.resolve([] as Record<string, unknown>[])),
  listAll: vi.fn(() => Promise.resolve([] as Record<string, unknown>[])),
};

const mockPrintingCitationsRepo = {
  listForPrintingIds: vi.fn(() => Promise.resolve([] as Record<string, unknown>[])),
};

const mockProductsRepo = {
  productsForCard: vi.fn(() => Promise.resolve([] as Record<string, unknown>[])),
};

const app = new Hono<{ Variables: Variables }>();
app.use("*", async (c, next) => {
  c.set("repos", {
    catalog: mockCatalogRepo,
    distributionChannels: mockDistributionChannelsRepo,
    printingCitations: mockPrintingCitationsRepo,
    products: mockProductsRepo,
    // oxlint-disable-next-line no-explicit-any -- test mock doesn't match full Repos type
  } as any);
  await next();
});
registerRouterForTest(app, cardsRouter);

const CARD_ID = "c0000000-0001-4000-a000-000000000001";
const OTHER_CARD_ID = "c0000000-0001-4000-a000-000000000002";
const SET_ID = "s0000000-0001-4000-a000-000000000001";
const PRINTING_ID = "p0000000-0001-4000-a000-000000000001";
const TOKEN_PRINTING_ID = "p0000000-0001-4000-a000-000000000002";
const FACE_2_ID = "f0000000-0001-4000-a000-000000000002";

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

const dbOtherCard = { ...dbCard, id: OTHER_CARD_ID, slug: "gold", name: "Gold", types: ["Rune"] };

const dbPrinting = {
  printingId: PRINTING_ID,
  side: 1,
  faceId: PRINTING_ID,
  otherSide: null,
  slug: "en-ogn-202-foil-standard",
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

const dbSet = {
  id: SET_ID,
  slug: "OGN",
  name: "Origins",
  releases: { EN: { releasedAt: "2025-10-31", precision: "day" as const } },
  setType: "main" as const,
};

const dbBan = {
  cardId: CARD_ID,
  formatId: "f0000000-0001-4000-a000-000000000001",
  formatName: "Constructed",
  bannedAt: "2026-01-15",
  reason: "Power level",
};

const dbMarkers = [
  { id: "m1", slug: "promo", label: "Promo", description: null },
  { id: "m2", slug: "signed", label: "Signed", description: null },
];

const dbChannels = [
  {
    id: "ch-parent",
    slug: "events",
    label: "Events",
    description: null,
    kind: "event",
    parentId: null,
    childrenLabel: null,
  },
  {
    id: "ch-child",
    slug: "nexus-night",
    label: "Nexus Night",
    description: null,
    kind: "event",
    parentId: "ch-parent",
    childrenLabel: null,
  },
  {
    id: "ch-unrelated",
    slug: "starter",
    label: "Starter",
    description: null,
    kind: "product",
    parentId: null,
    childrenLabel: null,
  },
];

function mockHappyPath(): void {
  mockCatalogRepo.cardBySlug.mockResolvedValue(dbCard);
  mockCatalogRepo.printingsByCardId.mockResolvedValue([dbPrinting]);
  mockCatalogRepo.setsByIds.mockResolvedValue([dbSet]);
  mockCatalogRepo.markersList.mockResolvedValue(dbMarkers);
  mockDistributionChannelsRepo.listAll.mockResolvedValue(dbChannels);
}

describe("GET /api/v1/cards/:cardSlug", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockCatalogRepo.cardsByIds.mockResolvedValue([]);
    mockCatalogRepo.printingsByCardId.mockResolvedValue([]);
    mockCatalogRepo.printingsByIds.mockResolvedValue([]);
    mockCatalogRepo.printingImagesByPrintingIds.mockResolvedValue([]);
    mockCatalogRepo.cardBansByCardIds.mockResolvedValue([]);
    mockCatalogRepo.cardErrataByCardIds.mockResolvedValue([]);
    mockCatalogRepo.setsByIds.mockResolvedValue([]);
    mockCatalogRepo.markersList.mockResolvedValue([]);
    mockCatalogRepo.relatedCards.mockResolvedValue([]);
    mockDistributionChannelsRepo.listForPrintingIds.mockResolvedValue([]);
    mockDistributionChannelsRepo.listAll.mockResolvedValue([]);
    mockPrintingCitationsRepo.listForPrintingIds.mockResolvedValue([]);
    mockProductsRepo.productsForCard.mockResolvedValue([]);
  });

  it("returns the card, its printings in the catalog value shape, and its sets", async () => {
    mockHappyPath();

    const res = await app.request("/api/v1/cards/jinx-rebel");
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.card.id).toBe(CARD_ID);
    expect(json.card.slug).toBe("jinx-rebel");
    expect(json.card.errata).toBeNull();
    expect(json.card.bans).toEqual([]);
    expect(json.cards).toEqual({});
    expect(Object.keys(json.printings)).toEqual([PRINTING_ID]);
    const printing = json.printings[PRINTING_ID];
    expect(printing).not.toHaveProperty("printingId");
    expect(printing).not.toHaveProperty("side");
    expect(printing).not.toHaveProperty("faceId");
    expect(printing.slug).toBe("en-ogn-202-foil-standard");
    expect(printing.markers).toEqual(["promo"]);
    expect(printing.distributionChannels).toEqual([]);
    expect(printing.images).toEqual([]);
    expect(json.sets).toEqual([dbSet]);
    expect(json.products).toEqual([]);
    expect(json).not.toHaveProperty("related");
  });

  it("lists only the markers the printings name, in catalog order", async () => {
    mockHappyPath();

    const json = await readJson(await app.request("/api/v1/cards/jinx-rebel"));
    expect(json.markers).toEqual([dbMarkers[0]]);
  });

  it("lists the channels the printings name together with their ancestors", async () => {
    mockHappyPath();
    mockDistributionChannelsRepo.listForPrintingIds.mockResolvedValue([
      {
        printingId: PRINTING_ID,
        channelId: "ch-child",
        channelSlug: "nexus-night",
        channelLabel: "Nexus Night",
        channelDescription: null,
        channelKind: "event",
        channelParentId: "ch-parent",
        channelChildrenLabel: null,
        distributionNote: "Top 8",
      },
    ]);

    const json = await readJson(await app.request("/api/v1/cards/jinx-rebel"));
    expect(json.printings[PRINTING_ID].distributionChannels).toEqual([
      { channel: "nexus-night", note: "Top 8" },
    ]);
    expect(json.distributionChannels.map((c: { slug: string }) => c.slug)).toEqual([
      "events",
      "nexus-night",
    ]);
  });

  it("nests the other side of a double-sided printing and ships its card", async () => {
    mockHappyPath();
    const side1 = {
      ...dbPrinting,
      printingId: TOKEN_PRINTING_ID,
      faceId: TOKEN_PRINTING_ID,
      slug: "en-ogn-t05-normal-standard",
      shortCode: "OGN-T05",
      otherSide: {
        faceId: FACE_2_ID,
        cardId: OTHER_CARD_ID,
        cardName: "Gold",
        cardSlug: "gold",
        shortCode: "OGN-T06",
      },
    };
    const side2 = {
      ...dbPrinting,
      printingId: TOKEN_PRINTING_ID,
      side: 2,
      faceId: FACE_2_ID,
      shortCode: "OGN-T06",
      cardId: OTHER_CARD_ID,
      markerSlugs: [],
      otherSide: {
        faceId: TOKEN_PRINTING_ID,
        cardId: CARD_ID,
        cardName: "Jinx, Rebel",
        cardSlug: "jinx-rebel",
        shortCode: "OGN-T05",
      },
    };
    mockCatalogRepo.printingsByCardId.mockResolvedValue([dbPrinting, side1]);
    mockCatalogRepo.printingsByIds.mockResolvedValue([
      { ...side1, slug: undefined },
      { ...side2, slug: undefined },
    ]);
    mockCatalogRepo.cardsByIds.mockResolvedValue([dbOtherCard]);

    const json = await readJson(await app.request("/api/v1/cards/jinx-rebel"));
    expect(mockCatalogRepo.printingsByIds).toHaveBeenCalledWith([TOKEN_PRINTING_ID]);
    expect(mockCatalogRepo.cardsByIds).toHaveBeenCalledWith([OTHER_CARD_ID]);
    const token = json.printings[TOKEN_PRINTING_ID];
    expect(token.slug).toBe("en-ogn-t05-normal-standard");
    expect(token.shortCode).toBe("OGN-T05");
    expect(token.side2).toMatchObject({
      faceId: FACE_2_ID,
      shortCode: "OGN-T06",
      cardId: OTHER_CARD_ID,
    });
    expect(json.cards[OTHER_CARD_ID]).toMatchObject({ slug: "gold", name: "Gold", bans: [] });
    expect(json.cards[OTHER_CARD_ID]).not.toHaveProperty("id");
    expect(json.cards).not.toHaveProperty(CARD_ID);
  });

  it("serves a card that is the back of a double-sided printing with the front's row and card", async () => {
    mockHappyPath();
    const back = {
      ...dbPrinting,
      printingId: TOKEN_PRINTING_ID,
      side: 2,
      faceId: FACE_2_ID,
      slug: "en-ogn-t06-normal-standard",
      shortCode: "OGN-T06",
      markerSlugs: [],
      otherSide: {
        faceId: TOKEN_PRINTING_ID,
        cardId: OTHER_CARD_ID,
        cardName: "Gold",
        cardSlug: "gold",
        shortCode: "OGN-T05",
      },
    };
    const front = {
      ...dbPrinting,
      printingId: TOKEN_PRINTING_ID,
      faceId: TOKEN_PRINTING_ID,
      slug: undefined,
      shortCode: "OGN-T05",
      cardId: OTHER_CARD_ID,
      otherSide: {
        faceId: FACE_2_ID,
        cardId: CARD_ID,
        cardName: "Jinx, Rebel",
        cardSlug: "jinx-rebel",
        shortCode: "OGN-T06",
      },
    };
    mockCatalogRepo.printingsByCardId.mockResolvedValue([back]);
    mockCatalogRepo.printingsByIds.mockResolvedValue([front, { ...back, slug: undefined }]);
    mockCatalogRepo.cardsByIds.mockResolvedValue([dbOtherCard]);

    const json = await readJson(await app.request("/api/v1/cards/jinx-rebel"));
    const token = json.printings[TOKEN_PRINTING_ID];
    expect(token.slug).toBe("en-ogn-t06-normal-standard");
    expect(token.cardId).toBe(OTHER_CARD_ID);
    expect(token.side2).toMatchObject({ faceId: FACE_2_ID, cardId: CARD_ID, markers: [] });
    expect(json.cards[OTHER_CARD_ID]).toMatchObject({ slug: "gold" });
    expect(json.markers).toEqual([dbMarkers[0]]);
  });

  it("keeps both faces of a printing that shows the card twice and ships no other card", async () => {
    mockHappyPath();
    const otherSide = (faceId: string, shortCode: string) => ({
      faceId,
      cardId: CARD_ID,
      cardName: "Jinx, Rebel",
      cardSlug: "jinx-rebel",
      shortCode,
    });
    const side1 = {
      ...dbPrinting,
      printingId: TOKEN_PRINTING_ID,
      faceId: TOKEN_PRINTING_ID,
      shortCode: "OGN-T05",
      otherSide: otherSide(FACE_2_ID, "OGN-T06"),
    };
    const side2 = {
      ...side1,
      side: 2,
      faceId: FACE_2_ID,
      shortCode: "OGN-T06",
      otherSide: otherSide(TOKEN_PRINTING_ID, "OGN-T05"),
    };
    mockCatalogRepo.printingsByCardId.mockResolvedValue([side1, side2]);
    mockCatalogRepo.printingsByIds.mockResolvedValue([
      { ...side1, slug: undefined },
      { ...side2, slug: undefined },
    ]);

    const json = await readJson(await app.request("/api/v1/cards/jinx-rebel"));
    expect(mockCatalogRepo.printingsByIds).toHaveBeenCalledWith([TOKEN_PRINTING_ID]);
    expect(mockCatalogRepo.cardsByIds).toHaveBeenCalledWith([]);
    const token = json.printings[TOKEN_PRINTING_ID];
    expect(token.slug).toBe(dbPrinting.slug);
    expect(token).toMatchObject({ cardId: CARD_ID, shortCode: "OGN-T05" });
    expect(token.side2).toMatchObject({ faceId: FACE_2_ID, cardId: CARD_ID, shortCode: "OGN-T06" });
    expect(json.cards).toEqual({});
  });

  it("maps bans and errata onto the card response", async () => {
    mockHappyPath();
    mockCatalogRepo.cardBansByCardIds.mockResolvedValue([dbBan]);
    mockCatalogRepo.cardErrataByCardIds.mockResolvedValue([
      {
        cardId: CARD_ID,
        correctedRulesText: "Corrected",
        correctedEffectText: null,
        source: "Riot",
        sourceUrl: null,
        effectiveDate: "2026-01-01",
      },
    ]);

    const json = await readJson(await app.request("/api/v1/cards/jinx-rebel"));
    expect(mockCatalogRepo.cardBansByCardIds).toHaveBeenCalledWith([CARD_ID]);
    expect(json.card.bans).toEqual([
      {
        formatId: dbBan.formatId,
        formatName: dbBan.formatName,
        bannedAt: dbBan.bannedAt,
        reason: dbBan.reason,
      },
    ]);
    expect(json.card.errata).toMatchObject({ correctedRulesText: "Corrected", source: "Riot" });
  });

  it("maps product back-references flat onto the response, not nested under the printing", async () => {
    mockHappyPath();
    mockProductsRepo.productsForCard.mockResolvedValue([
      { printingId: PRINTING_ID, slug: "prerift-jinx", name: "Pre-Rift Kit - Jinx", quantity: 2 },
    ]);

    const json = await readJson(await app.request("/api/v1/cards/jinx-rebel"));
    expect(json.products).toEqual([
      { printingId: PRINTING_ID, slug: "prerift-jinx", name: "Pre-Rift Kit - Jinx", quantity: 2 },
    ]);
    expect(json.printings[PRINTING_ID]).not.toHaveProperty("products");
    expect(mockProductsRepo.productsForCard).toHaveBeenCalledWith(CARD_ID);
  });

  it("returns NOT_FOUND for an unknown slug", async () => {
    mockCatalogRepo.cardBySlug.mockResolvedValue(undefined);

    const res = await app.request("/api/v1/cards/does-not-exist");
    expect(res.status).toBe(404);
    const json = await readJson(res);
    expect(json.message).toBe("Card not found: does-not-exist");
    expect(mockCatalogRepo.printingsByCardId).not.toHaveBeenCalled();
  });
});

describe("GET /api/v1/cards/:cardSlug/related", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("passes related cards through", async () => {
    mockCatalogRepo.cardBySlug.mockResolvedValue(dbCard);
    const relatedRow = {
      slug: "yasuo-windrider",
      name: "Yasuo, Windrider",
      types: ["unit"],
      domains: ["calm"],
      rarity: "epic",
      imageId: null,
    };
    mockCatalogRepo.relatedCards.mockResolvedValue([relatedRow]);

    const res = await app.request("/api/v1/cards/jinx-rebel/related");
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ related: [relatedRow] });
    expect(mockCatalogRepo.relatedCards).toHaveBeenCalledWith(CARD_ID, 8);
  });

  it("returns NOT_FOUND for an unknown slug", async () => {
    mockCatalogRepo.cardBySlug.mockResolvedValue(undefined);
    const res = await app.request("/api/v1/cards/does-not-exist/related");
    expect(res.status).toBe(404);
  });
});
