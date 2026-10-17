import type { CatalogResponse } from "@openrift/shared/types/api/catalog";
import type { InitResponse } from "@openrift/shared/types/api/init";
import { describe, expect, it } from "vitest";

import { buildCatalogSync, buildPricesSync, buildRulesSync } from "./catalog-sync.js";

const SET_ID = "00000000-0000-7000-8000-000000000001";
const CARD_ID = "00000000-0000-7000-8000-000000000002";
const TOKEN_ID = "00000000-0000-7000-8000-000000000003";
const PRINTING_ID = "00000000-0000-7000-8000-000000000004";
const IMAGE_ID = "00000000-0000-7000-8000-0000000000ab";
const FALLBACK_IMAGE_ID = "00000000-0000-7000-8000-0000000000cd";
const PARENT_CHANNEL_ID = "00000000-0000-7000-8000-000000000005";
const CHILD_CHANNEL_ID = "00000000-0000-7000-8000-000000000006";

const reference = { slug: "x", label: "X", sortOrder: 0 };

function channel(id: string, slug: string, parentId: string | null) {
  return {
    id,
    slug,
    label: slug,
    description: null,
    kind: "event" as const,
    parentId,
    childrenLabel: null,
  };
}

function makeInit(overrides: Partial<InitResponse> = {}): InitResponse {
  return {
    enums: {
      cardTypes: [{ slug: "unit", label: "Unit", sortOrder: 1 }],
      rarities: [{ ...reference, color: "#000000" }],
      domains: [{ slug: "fury", label: "Fury", sortOrder: 0, color: "#B32117" }],
      superTypes: [reference],
      finishes: [reference],
      artVariants: [reference],
      cardSizes: [reference],
      deckFormats: [reference],
      deckZones: [reference],
      conditions: [reference],
      graders: [reference],
      languages: [{ slug: "EN", label: "English", sortOrder: 0, color: null }],
      markers: [{ slug: "promo", label: "Promo", sortOrder: 0, description: null }],
    },
    keywords: {
      Shield: {
        color: "#123456",
        darkText: false,
        costKeyword: false,
        cardModifier: false,
        translations: { FR: "Bouclier" },
      },
    },
    distributionChannels: [
      channel(CHILD_CHANNEL_ID, "child-night", PARENT_CHANNEL_ID),
      channel(PARENT_CHANNEL_ID, "parent-night", null),
    ],
    customTags: [
      {
        id: "00000000-0000-7000-8000-000000000007",
        slug: "removal",
        label: "Removal",
        category: "function",
        categoryLabel: "Function",
        description: null,
        sortOrder: 0,
      },
    ],
    championIdentifierTags: [],
    tagCategories: [{ slug: "region", label: "Region", sortOrder: 0 }],
    tagCategoryMap: { Testland: "region" },
    ...overrides,
  };
}

type CatalogPrinting = CatalogResponse["printings"][string];

function makePrinting(): CatalogPrinting {
  return {
    shortCode: "TST-001",
    setId: SET_ID,
    rarity: "common",
    artVariant: "normal",
    isSigned: false,
    isOvernumbered: false,
    markers: [{ id: "m", slug: "promo", label: "Promo", description: null }],
    distributionChannels: [
      {
        channel: channel(CHILD_CHANNEL_ID, "child-night", PARENT_CHANNEL_ID),
        distributionNote: "Top 8",
        ancestorLabels: ["parent-night"],
      },
    ],
    citations: [{ id: "00000000-0000-7000-8000-000000000008", label: "Unboxing", sourceUrl: null }],
    finish: "normal",
    size: "standard",
    images: [{ face: "front", imageId: IMAGE_ID, credit: "tester" }],
    artist: "Test Artist",
    publicCode: "TST-001/010",
    printedRulesText: null,
    printedEffectText: null,
    flavorText: null,
    printedName: null,
    printedYear: 2026,
    language: "EN",
    comment: null,
    canonicalRank: 1,
    fallbackArtMode: "pinned",
    fallbackImageId: FALLBACK_IMAGE_ID,
    cardId: CARD_ID,
  };
}

function makeCatalog(overrides: Partial<CatalogResponse> = {}): CatalogResponse {
  return {
    sets: [
      {
        id: SET_ID,
        slug: "TST",
        name: "Test Set",
        releases: { EN: { releasedAt: "2026-01-01", precision: "day" } },
        setType: "main",
      },
    ],
    cards: {
      [CARD_ID]: {
        slug: "test-unit",
        name: "Test Unit",
        type: "unit",
        types: ["unit"],
        superTypes: [],
        domains: ["fury", "calm"],
        tokenCardIds: [TOKEN_ID],
        might: 3,
        energy: 2,
        power: null,
        keywords: ["Shield"],
        tags: ["Testland"],
        mightBonus: null,
        maxCopiesOverride: null,
        additionalLegendCount: null,
        errata: {
          correctedRulesText: "Draw 1.",
          correctedEffectText: null,
          source: "Test Errata",
          sourceUrl: null,
          effectiveDate: "2026-02-01",
        },
        bans: [
          { formatId: "standard", formatName: "Constructed", bannedAt: "2026-03-01", reason: null },
        ],
      },
    },
    printings: {
      [PRINTING_ID]: makePrinting(),
    },
    totalCopies: 0,
    customTagAssignments: { [CARD_ID]: ["removal", "unknown-tag"] },
    ...overrides,
  };
}

describe("buildCatalogSync", () => {
  it("keeps card, set and printing ids", () => {
    const rows = buildCatalogSync(makeInit(), makeCatalog());

    expect(rows.sets).toEqual([expect.objectContaining({ id: SET_ID, slug: "TST", sortOrder: 0 })]);
    expect(rows.cards).toEqual([expect.objectContaining({ id: CARD_ID, slug: "test-unit" })]);
    expect(rows.printings).toEqual([
      expect.objectContaining({ id: PRINTING_ID, cardId: CARD_ID, setId: SET_ID }),
    ]);
  });

  it("splits card arrays into ordered join rows", () => {
    const rows = buildCatalogSync(makeInit(), makeCatalog());

    expect(rows.cardDomains).toEqual([
      { cardId: CARD_ID, domainSlug: "fury", ordinal: 0 },
      { cardId: CARD_ID, domainSlug: "calm", ordinal: 1 },
    ]);
    expect(rows.cardCardTypes).toEqual([{ cardId: CARD_ID, typeSlug: "unit", position: 0 }]);
    expect(rows.cardTokens).toEqual([{ cardId: CARD_ID, tokenCardId: TOKEN_ID }]);
    expect(rows.cardBans).toEqual([
      { cardId: CARD_ID, formatId: "standard", bannedAt: "2026-03-01", reason: null },
    ]);
    expect(rows.formats).toEqual([{ id: "standard", name: "Constructed" }]);
  });

  it("writes errata as a sourced row", () => {
    const rows = buildCatalogSync(makeInit(), makeCatalog());

    expect(rows.cardErrata).toEqual([
      expect.objectContaining({ cardId: CARD_ID, source: "Test Errata", sourceUrl: null }),
    ]);
  });

  it("creates one rehosted image file per image id, including pinned fallbacks", () => {
    const rows = buildCatalogSync(makeInit(), makeCatalog());

    expect(rows.imageFiles).toEqual([
      { id: IMAGE_ID, rehostedUrl: `/media/cards/ab/${IMAGE_ID}`, credit: "tester" },
      {
        id: FALLBACK_IMAGE_ID,
        rehostedUrl: `/media/cards/cd/${FALLBACK_IMAGE_ID}`,
        credit: null,
      },
    ]);
    expect(rows.printingImages).toEqual([
      { printingId: PRINTING_ID, imageFileId: IMAGE_ID, face: "front", isActive: true },
    ]);
    expect(rows.printings[0]).toMatchObject({
      fallbackArtMode: "pinned",
      fallbackImageFileId: FALLBACK_IMAGE_ID,
      markerSlugs: ["promo"],
    });
  });

  it("dedupes an image shared by two printings", () => {
    const catalog = makeCatalogWithSharedImage();
    const rows = buildCatalogSync(makeInit(), catalog);

    expect(rows.imageFiles.filter((file) => file.id === IMAGE_ID)).toHaveLength(1);
    expect(rows.printingImages).toHaveLength(2);
  });

  it("defaults the fallback art mode to auto", () => {
    const { fallbackArtMode: _mode, fallbackImageId: _image, ...printing } = makePrinting();
    const rows = buildCatalogSync(
      makeInit(),
      makeCatalog({ printings: { [PRINTING_ID]: printing } }),
    );

    expect(rows.printings[0]).toMatchObject({ fallbackArtMode: "auto", fallbackImageFileId: null });
  });

  it("orders distribution channels parents first and links children by slug", () => {
    const rows = buildCatalogSync(makeInit(), makeCatalog());

    expect(rows.distributionChannels.map((row) => [row.slug, row.parentSlug])).toEqual([
      ["parent-night", null],
      ["child-night", "parent-night"],
    ]);
    expect(rows.printingDistributionChannels).toEqual([
      { printingId: PRINTING_ID, channelSlug: "child-night", distributionNote: "Top 8" },
    ]);
  });

  it("maps languages, keywords and their translations", () => {
    const rows = buildCatalogSync(makeInit(), makeCatalog());

    expect(rows.languages).toEqual([{ code: "EN", name: "English", sortOrder: 0, color: null }]);
    expect(rows.keywords).toEqual([
      {
        name: "Shield",
        color: "#123456",
        darkText: false,
        costKeyword: false,
        cardModifier: false,
      },
    ]);
    expect(rows.keywordTranslations).toEqual([
      { keywordName: "Shield", language: "FR", label: "Bouclier" },
    ]);
  });

  it("derives custom tag categories and drops assignments to unknown tags", () => {
    const rows = buildCatalogSync(makeInit(), makeCatalog());

    expect(rows.customTagCategories).toEqual([
      { slug: "function", label: "Function", sortOrder: 0 },
    ]);
    expect(rows.customTags).toEqual([
      expect.objectContaining({ slug: "removal", categorySlug: "function" }),
    ]);
    expect(rows.cardCustomTags).toEqual([{ cardId: CARD_ID, customTagSlug: "removal" }]);
    expect(rows.tagDefinitions).toEqual([{ tag: "Testland", categorySlug: "region" }]);
  });

  it("returns empty catalog tables for an empty catalog", () => {
    const rows = buildCatalogSync(
      makeInit(),
      makeCatalog({ sets: [], cards: {}, printings: {}, customTagAssignments: {} }),
    );

    expect(rows.cards).toEqual([]);
    expect(rows.printings).toEqual([]);
    expect(rows.imageFiles).toEqual([]);
    expect(rows.formats).toEqual([]);
  });
});

function makeCatalogWithSharedImage(): CatalogResponse {
  return makeCatalog({
    printings: {
      [PRINTING_ID]: makePrinting(),
      "00000000-0000-7000-8000-000000000009": { ...makePrinting(), shortCode: "TST-001a" },
    },
  });
}

describe("buildRulesSync", () => {
  const version = {
    kind: "core" as const,
    language: "fr" as const,
    version: "2026-01-01",
    comments: "Test note",
    commentsHtml: "<p>Test note</p>",
    label: "Test Set",
    documentVersion: "1.0",
    importedAt: "2026-01-02T03:04:05.000Z",
    languages: ["en" as const, "fr" as const],
  };
  const rule = {
    id: "00000000-0000-7000-8000-000000000010",
    kind: "core" as const,
    language: "fr" as const,
    version: "2026-01-01",
    ruleNumber: "100.1",
    sortOrder: 3,
    depth: 1,
    ruleType: "text" as const,
    content: "Test rule.",
    changeType: "unchanged" as const,
  };

  it("drops the rendered and derived version fields", () => {
    const rows = buildRulesSync([version], []);

    expect(rows.ruleVersions).toEqual([
      {
        kind: "core",
        language: "fr",
        version: "2026-01-01",
        comments: "Test note",
        label: "Test Set",
        documentVersion: "1.0",
        importedAt: new Date("2026-01-02T03:04:05.000Z"),
      },
    ]);
  });

  it("keeps rule ids and change types across every list", () => {
    const added = {
      ...rule,
      id: "00000000-0000-7000-8000-000000000011",
      changeType: "added" as const,
    };
    const rows = buildRulesSync(
      [version],
      [
        { kind: "core", language: "fr", version: "2026-01-01", rules: [rule] },
        { kind: "core", language: "fr", version: "2026-01-01", rules: [added] },
      ],
    );

    expect(rows.rules).toEqual([rule, added]);
  });
});

describe("buildPricesSync", () => {
  const TODAY = new Date("2026-05-10T00:00:00.000Z");
  const SECOND_PRINTING_ID = "00000000-0000-7000-8000-000000000012";
  const missing = { available: false, productId: null };
  const catalog = makeCatalog({
    printings: {
      [PRINTING_ID]: makePrinting(),
      [SECOND_PRINTING_ID]: { ...makePrinting(), shortCode: "TST-001a" },
    },
  });
  const currencies = {
    tcgplayer: "USD",
    cardmarket: "EUR",
    cardtrader: "EUR",
    cardnexus: "EUR",
  } as const;
  const infos = {
    [PRINTING_ID]: {
      tcgplayer: { available: true, productId: 11 },
      cardmarket: { available: true, productId: 22 },
      cardtrader: missing,
      cardnexus: missing,
    },
    [SECOND_PRINTING_ID]: {
      tcgplayer: { available: true, productId: 11 },
      cardmarket: missing,
      cardtrader: missing,
      cardnexus: missing,
    },
  };

  it("puts the headline in the column the price view reads", () => {
    const rows = buildPricesSync(
      { prices: { [PRINTING_ID]: { tcgplayer: 450, cardmarket: 380 } }, currencies, stale: {} },
      infos,
      catalog,
      TODAY,
    );

    expect(rows.products).toEqual([
      expect.objectContaining({
        marketplace: "tcgplayer",
        externalId: 11,
        productName: "Test Unit",
      }),
      expect.objectContaining({ marketplace: "cardmarket", externalId: 22 }),
    ]);
    expect(rows.prices).toEqual([
      { skuKey: "tcgplayer|11|normal|EN", recordedAt: TODAY, marketCents: 450 },
      { skuKey: "cardmarket|22|normal|EN", recordedAt: TODAY, lowCents: 380 },
    ]);
  });

  it("dates a stale price back by its stale age", () => {
    const rows = buildPricesSync(
      {
        prices: { [PRINTING_ID]: { tcgplayer: 450 } },
        currencies,
        stale: { [PRINTING_ID]: { tcgplayer: 3 } },
      },
      infos,
      catalog,
      TODAY,
    );

    expect(rows.prices[0]?.recordedAt).toEqual(new Date("2026-05-07T00:00:00.000Z"));
  });

  it("shares one product between printings with the same SKU", () => {
    const rows = buildPricesSync(
      {
        prices: { [PRINTING_ID]: { tcgplayer: 450 }, [SECOND_PRINTING_ID]: { tcgplayer: 450 } },
        currencies,
        stale: {},
      },
      infos,
      catalog,
      TODAY,
    );

    expect(rows.products).toHaveLength(1);
    expect(rows.variants).toEqual([
      { skuKey: "tcgplayer|11|normal|EN", printingId: PRINTING_ID },
      { skuKey: "tcgplayer|11|normal|EN", printingId: SECOND_PRINTING_ID },
    ]);
  });

  it("skips prices without a product id or a known printing", () => {
    const rows = buildPricesSync(
      {
        prices: {
          [PRINTING_ID]: { cardtrader: 300 },
          "00000000-0000-7000-8000-0000000000ff": { tcgplayer: 100 },
        },
        currencies,
        stale: {},
      },
      infos,
      catalog,
      TODAY,
    );

    expect(rows).toEqual({ groups: [], products: [], variants: [], prices: [] });
  });
});
