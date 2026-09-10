import { describe, expect, it } from "vitest";

import type {
  ScoredSuggestion,
  SuggestionLookup,
} from "@/features/catalog-admin/lib/marketplace-product-groups";
import {
  acceptableAssignments,
  buildMarketplaceProductGroups,
  displayedProductLanguage,
  isCardNameMismatch,
  strongAssignments,
  suggestionCounts,
  suggestionStrength,
  weakAssignments,
} from "@/features/catalog-admin/lib/marketplace-product-groups";
import {
  makeStagedProduct,
  makeUnifiedMappingGroup,
  makeUnifiedMappingPrinting,
} from "@/test/factories";

const STRONG = 150;

const noSuggestions: SuggestionLookup = () => [];

function lookup(entries: Record<string, ScoredSuggestion[]>): SuggestionLookup {
  return (marketplace, externalId, finish, language) =>
    entries[`${marketplace}::${externalId}::${finish}::${language ?? ""}`] ?? [];
}

const enNormal = makeUnifiedMappingPrinting({ printingId: "p-en", shortCode: "OGN-001" });
const enFoil = makeUnifiedMappingPrinting({
  printingId: "p-en-foil",
  shortCode: "OGN-001",
  finish: "foil",
});

describe("suggestionStrength", () => {
  it("calls a score at the cut-off strong", () => {
    expect(suggestionStrength({ printingId: "p-en", score: 150 }, STRONG)).toBe("strong");
  });

  it("calls a lower score weak", () => {
    expect(suggestionStrength({ printingId: "p-en", score: 149 }, STRONG)).toBe("weak");
  });

  it("respects an explicit weak flag whatever the score", () => {
    expect(suggestionStrength({ printingId: "p-en", score: 900, isWeak: true }, STRONG)).toBe(
      "weak",
    );
  });
});

describe("displayedProductLanguage", () => {
  it("drops Cardmarket's placeholder language", () => {
    expect(displayedProductLanguage("cardmarket", "EN")).toBeNull();
  });

  it("keeps a CardTrader language", () => {
    expect(displayedProductLanguage("cardtrader", "SC")).toBe("SC");
  });
});

describe("isCardNameMismatch", () => {
  it("accepts a product named after the card", () => {
    expect(isCardNameMismatch("Lux, Lady of Luminosity", "Lux, Lady of Luminosity")).toBe(false);
  });

  it("flags a product named after another card", () => {
    expect(isCardNameMismatch("Jinx, Rebel", "Lux, Lady of Luminosity")).toBe(true);
  });
});

describe("buildMarketplaceProductGroups", () => {
  it("groups variants under one product id and carries its set name", () => {
    const group = makeUnifiedMappingGroup({
      printings: [enNormal, enFoil],
      tcgplayer: {
        stagedProducts: [
          makeStagedProduct({ externalId: 7, finish: "foil", groupName: "Origins" }),
          makeStagedProduct({ externalId: 7, finish: "normal", groupName: "Origins" }),
        ],
        assignedProducts: [],
        assignments: [],
      },
    });

    const groups = buildMarketplaceProductGroups(group, noSuggestions, STRONG);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.externalId).toBe(7);
    expect(groups[0]?.groupName).toBe("Origins");
    expect(groups[0]?.variants.map((variant) => variant.finish)).toEqual(["foil", "normal"]);
  });

  it("lists the printings a variant is linked to", () => {
    const group = makeUnifiedMappingGroup({
      printings: [enNormal],
      cardmarket: {
        stagedProducts: [],
        assignedProducts: [makeStagedProduct({ externalId: 3 })],
        assignments: [{ externalId: 3, printingId: "p-en", finish: "normal", language: null }],
      },
    });

    const [variant] =
      buildMarketplaceProductGroups(group, noSuggestions, STRONG)[0]?.variants ?? [];
    expect(variant?.linked.map((printing) => printing.printingId)).toEqual(["p-en"]);
    expect(variant?.unlinkedReason).toBeNull();
    expect(variant?.displayLanguage).toBeNull();
  });

  it("attaches suggestions with their strength to an unlinked variant", () => {
    const group = makeUnifiedMappingGroup({
      printings: [enNormal],
      tcgplayer: {
        stagedProducts: [makeStagedProduct({ externalId: 4 })],
        assignedProducts: [],
        assignments: [],
      },
    });

    const groups = buildMarketplaceProductGroups(
      group,
      lookup({ "tcgplayer::4::normal::EN": [{ printingId: "p-en", score: 200 }] }),
      STRONG,
    );
    const [variant] = groups[0]?.variants ?? [];
    expect(variant?.suggestions).toEqual([
      {
        printingId: "p-en",
        shortCode: "OGN-001",
        language: "EN",
        finish: "normal",
        markerSlugs: [],
        size: "standard",
        strength: "strong",
      },
    ]);
    expect(suggestionCounts(groups)).toEqual({ strong: 1, weak: 0, total: 1 });
  });

  it("offers no suggestion for a product already assigned to another card", () => {
    const override = makeStagedProduct({ externalId: 21, isOverride: true });
    const group = makeUnifiedMappingGroup({
      printings: [enNormal],
      tcgplayer: {
        stagedProducts: [],
        assignedProducts: [override],
        assignments: [],
      },
    });

    const groups = buildMarketplaceProductGroups(
      group,
      lookup({ "tcgplayer::21::normal::EN": [{ printingId: "p-en", score: 400 }] }),
      STRONG,
    );
    const [variant] = groups[0]?.variants ?? [];
    expect(variant?.suggestions).toEqual([]);
    expect(variant?.isOverride).toBe(true);
    expect(strongAssignments(groups)).toEqual([]);
  });

  it("explains an unlinked variant whose finish no printing carries", () => {
    const group = makeUnifiedMappingGroup({
      printings: [enNormal],
      tcgplayer: {
        stagedProducts: [makeStagedProduct({ externalId: 5, finish: "foil" })],
        assignedProducts: [],
        assignments: [],
      },
    });

    const [variant] =
      buildMarketplaceProductGroups(group, noSuggestions, STRONG)[0]?.variants ?? [];
    expect(variant?.unlinkedReason).toBe("No printing has this finish");
  });

  it("explains an unlinked variant on a marketplace that carries no printing", () => {
    const sc = makeUnifiedMappingPrinting({ printingId: "p-sc", language: "SC" });
    const group = makeUnifiedMappingGroup({
      printings: [sc],
      tcgplayer: {
        stagedProducts: [makeStagedProduct({ externalId: 6 })],
        assignedProducts: [],
        assignments: [],
      },
    });

    const [variant] =
      buildMarketplaceProductGroups(group, noSuggestions, STRONG)[0]?.variants ?? [];
    expect(variant?.unlinkedReason).toBe(
      "This marketplace does not carry any of the card's languages",
    );
  });

  it("flags a price older than two days as stale", () => {
    const group = makeUnifiedMappingGroup({
      printings: [enNormal],
      tcgplayer: {
        stagedProducts: [
          makeStagedProduct({ externalId: 8, recordedAt: "2020-01-01T00:00:00.000Z" }),
        ],
        assignedProducts: [],
        assignments: [],
      },
    });

    const [variant] =
      buildMarketplaceProductGroups(group, noSuggestions, STRONG)[0]?.variants ?? [];
    expect(variant?.isStale).toBe(true);
    expect(variant?.priceCents).toBe(450);
  });

  it("keeps the staged copy when a product is both staged and assigned", () => {
    const staged = makeStagedProduct({ externalId: 11, productName: "Staged copy" });
    const assigned = makeStagedProduct({ externalId: 11, productName: "Assigned copy" });
    const group = makeUnifiedMappingGroup({
      printings: [enNormal],
      tcgplayer: {
        stagedProducts: [staged],
        assignedProducts: [assigned],
        assignments: [{ externalId: 11, printingId: "p-en", finish: "normal", language: "EN" }],
      },
    });

    const [productGroup] = buildMarketplaceProductGroups(group, noSuggestions, STRONG);
    expect(productGroup?.variants).toHaveLength(1);
    expect(productGroup?.productName).toBe("Staged copy");
    expect(productGroup?.variants[0]?.isAssigned).toBe(true);
  });

  it("records the printings a sibling product already holds", () => {
    const group = makeUnifiedMappingGroup({
      printings: [enNormal, enFoil],
      tcgplayer: {
        stagedProducts: [makeStagedProduct({ externalId: 31, finish: "foil" })],
        assignedProducts: [],
        assignments: [{ externalId: 30, printingId: "p-en", finish: "normal", language: "EN" }],
      },
    });

    const [variant] =
      buildMarketplaceProductGroups(group, noSuggestions, STRONG)[0]?.variants ?? [];
    expect([...(variant?.otherAssignedPrintingIds ?? [])]).toEqual(["p-en"]);
  });
});

describe("acceptableAssignments", () => {
  function twoSuggestionGroups(strongScore: number, weakScore: number) {
    const group = makeUnifiedMappingGroup({
      printings: [enNormal, enFoil],
      tcgplayer: {
        stagedProducts: [
          makeStagedProduct({ externalId: 12 }),
          makeStagedProduct({ externalId: 13, finish: "foil" }),
        ],
        assignedProducts: [],
        assignments: [],
      },
    });
    return buildMarketplaceProductGroups(
      group,
      lookup({
        "tcgplayer::12::normal::EN": [{ printingId: "p-en", score: strongScore }],
        "tcgplayer::13::foil::EN": [{ printingId: "p-en-foil", score: weakScore }],
      }),
      STRONG,
    );
  }

  it("takes only the strong matches when both kinds are present", () => {
    const groups = twoSuggestionGroups(250, 100);
    expect(acceptableAssignments(groups)).toEqual({
      strength: "strong",
      assignments: [
        {
          marketplace: "tcgplayer",
          externalId: 12,
          finish: "normal",
          language: "EN",
          printingId: "p-en",
        },
      ],
    });
    expect(suggestionCounts(groups)).toEqual({ strong: 1, weak: 1, total: 2 });
  });

  it("falls through to the weak matches when no strong one is on the page", () => {
    const groups = twoSuggestionGroups(100, 100);
    const result = acceptableAssignments(groups);
    expect(result.strength).toBe("weak");
    expect(result.assignments).toHaveLength(2);
    expect(weakAssignments(groups)).toHaveLength(2);
  });

  it("returns nothing when there is no suggestion at all", () => {
    expect(acceptableAssignments([])).toEqual({ strength: "weak", assignments: [] });
  });
});
