import { marketplaceSkuKey } from "@openrift/shared/marketplace-sku-key";
import type { ProductSuggestion } from "@openrift/shared/marketplace-suggestions";
import type {
  MarketplaceAssignmentResponse,
  StagedProductResponse,
  UnifiedMappingGroupResponse,
  UnifiedMappingPrintingResponse,
} from "@openrift/shared/types/api/admin";
import { describe, expect, it } from "vitest";

import { buildCardListings } from "./card-listing-rows";

function printing(
  overrides: Partial<UnifiedMappingPrintingResponse> = {},
): UnifiedMappingPrintingResponse {
  return {
    printingId: "p-en",
    setId: "ogn",
    shortCode: "OGN-001",
    rarity: "common",
    artVariant: "normal",
    isSigned: false,
    isOvernumbered: false,
    markerSlugs: [],
    finish: "normal",
    size: "standard",
    language: "EN",
    imageUrl: null,
    tcgExternalId: null,
    cmExternalId: null,
    ctExternalId: null,
    cnExternalId: null,
    ...overrides,
  };
}

function staged(overrides: Partial<StagedProductResponse> = {}): StagedProductResponse {
  return {
    externalId: 1,
    productName: "Product",
    finish: "normal",
    language: "EN",
    marketCents: 100,
    lowCents: null,
    zeroLowCents: null,
    midCents: null,
    highCents: null,
    trendCents: null,
    avg1Cents: null,
    avg7Cents: null,
    avg30Cents: null,
    currency: "USD",
    recordedAt: new Date().toISOString(),
    ...overrides,
  };
}

interface Bucket {
  staged: StagedProductResponse[];
  assigned: StagedProductResponse[];
  assignments: MarketplaceAssignmentResponse[];
}

function group(
  printings: UnifiedMappingPrintingResponse[],
  perMarketplace: Partial<Record<"tcgplayer" | "cardmarket" | "cardtrader", Partial<Bucket>>> = {},
): UnifiedMappingGroupResponse {
  const empty: Bucket = { staged: [], assigned: [], assignments: [] };
  const tcg = { ...empty, ...perMarketplace.tcgplayer };
  const cm = { ...empty, ...perMarketplace.cardmarket };
  const ct = { ...empty, ...perMarketplace.cardtrader };
  return {
    cardId: "c-1",
    cardSlug: "fireball",
    cardName: "Fireball",
    superTypes: [],
    domains: ["fury"],
    energy: 1,
    might: null,
    setId: "set-1",
    setName: "Set",
    primaryShortCode: "OGN-001",
    printings,
    tcgplayer: {
      stagedProducts: tcg.staged,
      assignedProducts: tcg.assigned,
      assignments: tcg.assignments,
    },
    cardmarket: {
      stagedProducts: cm.staged,
      assignedProducts: cm.assigned,
      assignments: cm.assignments,
    },
    cardtrader: {
      stagedProducts: ct.staged,
      assignedProducts: ct.assigned,
      assignments: ct.assignments,
    },
    cardnexus: { stagedProducts: [], assignedProducts: [], assignments: [] },
  };
}

function suggestionsFor(
  entries: [StagedProductResponse, ProductSuggestion[]][],
): Map<string, ProductSuggestion[]> {
  return new Map(
    entries.map(([product, list]) => [
      marketplaceSkuKey("cardtrader", product.externalId, product.finish, product.language),
      list,
    ]),
  );
}

describe("buildCardListings", () => {
  const en = printing({ printingId: "p-en" });
  const zh = printing({ printingId: "p-zh", language: "ZH" });

  it("splits unassigned from assigned listings", () => {
    const open = staged({ externalId: 1 });
    const mapped = staged({ externalId: 2 });
    const result = buildCardListings(
      group([en], {
        cardtrader: {
          staged: [open],
          assigned: [mapped],
          assignments: [{ externalId: 2, finish: "normal", language: "EN", printingId: "p-en" }],
        },
      }),
      new Map(),
    );
    expect(result.unassigned.map((row) => row.product.externalId)).toEqual([1]);
    expect(result.assigned.map((row) => row.product.externalId)).toEqual([2]);
    expect(result.assigned[0]?.assignedPrintings.map((p) => p.printingId)).toEqual(["p-en"]);
  });

  it("picks the best-scored suggestion and grades its strength", () => {
    const strongRow = staged({ externalId: 1 });
    const possibleRow = staged({ externalId: 2 });
    const weakRow = staged({ externalId: 3 });
    const result = buildCardListings(
      group([en, zh], { cardtrader: { staged: [strongRow, possibleRow, weakRow] } }),
      suggestionsFor([
        [
          strongRow,
          [
            { printingId: "p-zh", score: 40 },
            { printingId: "p-en", score: 200 },
          ],
        ],
        [possibleRow, [{ printingId: "p-en", score: 80 }]],
        [weakRow, [{ printingId: "p-en", score: 1, isWeak: true }]],
      ]),
    );
    const byId = new Map(result.unassigned.map((row) => [row.product.externalId, row]));
    expect(byId.get(1)?.suggestion).toMatchObject({
      printing: { printingId: "p-en" },
      strength: "strong",
    });
    expect(byId.get(2)?.suggestion?.strength).toBe("possible");
    expect(byId.get(3)?.suggestion?.strength).toBe("weak");
  });

  it("collects only strong suggestions of unassigned listings for Accept strong", () => {
    const strongRow = staged({ externalId: 1 });
    const possibleRow = staged({ externalId: 2 });
    const result = buildCardListings(
      group([en], { cardtrader: { staged: [strongRow, possibleRow] } }),
      suggestionsFor([
        [strongRow, [{ printingId: "p-en", score: 200 }]],
        [possibleRow, [{ printingId: "p-en", score: 80 }]],
      ]),
    );
    expect(result.strongCount).toBe(1);
    expect(result.strong.cardtrader).toEqual([
      { externalId: 1, finish: "normal", language: "EN", printingId: "p-en" },
    ]);
  });

  it("drops suggestions that point at a printing outside the card", () => {
    const row = staged({ externalId: 1 });
    const result = buildCardListings(
      group([en], { cardtrader: { staged: [row] } }),
      suggestionsFor([[row, [{ printingId: "elsewhere", score: 500 }]]]),
    );
    expect(result.unassigned[0]?.suggestion).toBeNull();
    expect(result.strongCount).toBe(0);
  });

  it("lists a printing once when two assignments cover it", () => {
    const product = staged({ externalId: 7 });
    const result = buildCardListings(
      group([en], {
        cardmarket: {
          assigned: [product],
          assignments: [
            { externalId: 7, finish: "normal", language: null, printingId: "p-en" },
            { externalId: 7, finish: "normal", language: "EN", printingId: "p-en" },
          ],
        },
      }),
      new Map(),
    );
    expect(result.assigned[0]?.assignedPrintings.map((p) => p.printingId)).toEqual(["p-en"]);
  });

  it("shows no listing without products", () => {
    const result = buildCardListings(group([en]), new Map());
    expect(result.unassigned).toEqual([]);
    expect(result.assigned).toEqual([]);
  });
});

describe("buildCardListings rows", () => {
  it("keeps a product's variants together and heads them with one row", () => {
    const rows = buildCardListings(
      group([printing({ printingId: "p-1" })], {
        cardtrader: {
          staged: [
            staged({ externalId: 1, finish: "normal", language: "EN" }),
            staged({ externalId: 2, finish: "normal", language: "EN" }),
          ],
          assigned: [staged({ externalId: 1, finish: "foil", language: "EN" })],
          assignments: [{ externalId: 1, printingId: "p-1", finish: "foil", language: "EN" }],
        },
      }),
      new Map(),
    ).rows.cardtrader;

    expect(rows.map((row) => row.product.externalId)).toEqual([1, 1, 2]);
    expect(rows.map((row) => row.showProduct)).toEqual([true, false, true]);
  });

  it("drops the other marketplaces' rows", () => {
    const { rows } = buildCardListings(
      group([printing()], {
        cardtrader: { staged: [staged({ externalId: 1 })], assigned: [], assignments: [] },
        tcgplayer: { staged: [staged({ externalId: 9 })], assigned: [], assignments: [] },
      }),
      new Map(),
    );

    expect(rows.tcgplayer.map((row) => row.marketplace)).toEqual(["tcgplayer"]);
  });
});

describe("buildCardListings strong", () => {
  it("returns empty arrays for every marketplace when no suggestions are provided", () => {
    const result = buildCardListings(group([printing()]), new Map()).strong;
    expect(result).toEqual({ tcgplayer: [], cardmarket: [], cardtrader: [], cardnexus: [] });
  });

  it("filters out suggestions whose score is below the strong-match threshold", () => {
    const g = group([printing({ printingId: "p-1" })], {
      tcgplayer: { staged: [staged({ externalId: 1 })], assigned: [], assignments: [] },
    });
    const suggestions = new Map<string, ProductSuggestion[]>([
      [marketplaceSkuKey("tcgplayer", 1, "normal", "EN"), [{ printingId: "p-1", score: 100 }]],
    ]);
    expect(buildCardListings(g, suggestions).strong.tcgplayer).toEqual([]);
  });

  it("includes strong suggestions for unassigned products", () => {
    const g = group([printing({ printingId: "p-1" })], {
      tcgplayer: { staged: [staged({ externalId: 1 })], assigned: [], assignments: [] },
    });
    const suggestions = new Map<string, ProductSuggestion[]>([
      [marketplaceSkuKey("tcgplayer", 1, "normal", "EN"), [{ printingId: "p-1", score: 200 }]],
    ]);
    expect(buildCardListings(g, suggestions).strong.tcgplayer).toEqual([
      { externalId: 1, finish: "normal", language: "EN", printingId: "p-1" },
    ]);
  });

  it("skips products that are already assigned", () => {
    const product = staged({ externalId: 1 });
    const g = group([printing({ printingId: "p-1" })], {
      cardtrader: {
        staged: [],
        assigned: [product],
        assignments: [{ externalId: 1, printingId: "p-1", finish: "normal", language: "EN" }],
      },
    });
    const suggestions = new Map<string, ProductSuggestion[]>([
      [marketplaceSkuKey("cardtrader", 1, "normal", "EN"), [{ printingId: "p-1", score: 200 }]],
    ]);
    expect(buildCardListings(g, suggestions).strong.cardtrader).toEqual([]);
  });

  it("emits every sibling printing for one language-aggregate product", () => {
    const en = printing({ printingId: "p-en", language: "EN" });
    const sc = printing({ printingId: "p-sc", language: "SC" });
    const g = group([en, sc], {
      cardmarket: {
        staged: [staged({ externalId: 99, language: null })],
        assigned: [],
        assignments: [],
      },
    });
    const suggestions = new Map<string, ProductSuggestion[]>([
      [
        marketplaceSkuKey("cardmarket", 99, "normal", null),
        [
          { printingId: "p-en", score: 150 },
          { printingId: "p-sc", score: 150 },
        ],
      ],
    ]);
    const result = buildCardListings(g, suggestions).strong;
    expect(result.cardmarket).toHaveLength(2);
    expect(result.cardmarket.map((m) => m.printingId).toSorted()).toEqual(["p-en", "p-sc"]);
    expect(result.cardmarket.every((m) => m.language === null)).toBe(true);
  });

  it("segregates mappings by marketplace so one bucket can't leak into another", () => {
    const g = group([printing({ printingId: "p-1" })], {
      tcgplayer: { staged: [staged({ externalId: 1 })], assigned: [], assignments: [] },
      cardmarket: {
        staged: [staged({ externalId: 2, language: null })],
        assigned: [],
        assignments: [],
      },
    });
    const suggestions = new Map<string, ProductSuggestion[]>([
      [marketplaceSkuKey("tcgplayer", 1, "normal", "EN"), [{ printingId: "p-1", score: 200 }]],
      [marketplaceSkuKey("cardmarket", 2, "normal", null), [{ printingId: "p-1", score: 200 }]],
    ]);
    const result = buildCardListings(g, suggestions).strong;
    expect(result.tcgplayer).toHaveLength(1);
    expect(result.cardmarket).toHaveLength(1);
    expect(result.cardtrader).toEqual([]);
  });
});

describe("buildCardListings weak", () => {
  it("returns empty arrays for every marketplace when no suggestions are provided", () => {
    const result = buildCardListings(group([printing()]), new Map()).weak;
    expect(result).toEqual({ tcgplayer: [], cardmarket: [], cardtrader: [], cardnexus: [] });
  });

  it("includes weak suggestions for unassigned products and ignores non-weak ones", () => {
    const g = group([printing({ printingId: "p-foil", finish: "foil" })], {
      cardmarket: {
        staged: [staged({ externalId: 1, finish: "normal", language: null })],
        assigned: [],
        assignments: [],
      },
    });
    const suggestions = new Map<string, ProductSuggestion[]>([
      [
        marketplaceSkuKey("cardmarket", 1, "normal", null),
        [{ printingId: "p-foil", score: 50, isWeak: true }],
      ],
      [marketplaceSkuKey("tcgplayer", 2, "normal", "EN"), [{ printingId: "p-foil", score: 200 }]],
    ]);
    const result = buildCardListings(g, suggestions).weak;
    expect(result.cardmarket).toEqual([
      { externalId: 1, finish: "normal", language: null, printingId: "p-foil" },
    ]);
    expect(result.tcgplayer).toEqual([]);
  });
});
