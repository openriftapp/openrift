import { joinCatalogPrintings } from "@openrift/shared/catalog-join";
import { parseSearchQuery } from "@openrift/shared/search-query/parse";
import { makeCatalogReference } from "@openrift/shared/test-factories";
import type { CatalogResponse } from "@openrift/shared/types/api/catalog";
import { describe, expect, it } from "vitest";

import type { CatalogSearchSource } from "./catalog-search";
import {
  buildNamedCardIndex,
  namedCard,
  queryReadsPrices,
  randomCard,
  runCatalogSearch,
  SEARCH_MAX_NODES,
} from "./catalog-search";

const OGN = "set-ogn";
const SFD = "set-sfd";

function card(name: string, overrides: Partial<CatalogResponse["cards"][string]> = {}) {
  return {
    slug: name.toLowerCase(),
    name,
    types: ["unit"],
    superTypes: [],
    domains: ["fury"],
    tokenCardIds: [],
    energy: 3,
    might: 2,
    power: 1,
    keywords: [],
    tags: [],
    mightBonus: 0,
    maxCopiesOverride: null,
    errata: null,
    bans: [],
    ...overrides,
  } as CatalogResponse["cards"][string];
}

function printing(
  cardId: string,
  shortCode: string,
  overrides: Partial<CatalogResponse["printings"][string]> = {},
) {
  return {
    cardId,
    shortCode,
    setId: OGN,
    rarity: "common",
    artVariant: "normal",
    isSigned: false,
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
    ...overrides,
  } as CatalogResponse["printings"][string];
}

const catalog = {
  sets: [
    { id: OGN, slug: "OGN", name: "Origins", releases: {}, setType: "main" },
    { id: SFD, slug: "SFD", name: "Spiritforged", releases: {}, setType: "main" },
  ],
  cards: {
    garen: card("Garen", { energy: 5 }),
    annie: card("Annie", {
      types: ["spell"],
      domains: ["fury", "chaos"],
      energy: 2,
      bans: [
        { formatId: "standard", formatName: "Constructed", bannedAt: "2026-01-01", reason: null },
      ],
    }),
    jinx: card("Jinx", { domains: ["chaos"], energy: 1 }),
  },
  printings: {
    "garen-1": printing("garen", "OGN-001"),
    "garen-2": printing("garen", "OGN-001a", { finish: "foil", canonicalRank: 1 }),
    "annie-1": printing("annie", "SFD-010", { setId: SFD, rarity: "epic" }),
    "jinx-1": printing("jinx", "OGN-020"),
  },
  ...makeCatalogReference({
    enums: {
      cardTypes: [],
      superTypes: [],
      domains: ["fury", "calm", "chaos"].map((slug, sortOrder) => ({
        slug,
        label: slug,
        sortOrder,
      })),
      rarities: ["common", "uncommon", "rare", "epic"].map((slug, sortOrder) => ({
        slug,
        label: slug,
        sortOrder,
      })),
      finishes: [],
      artVariants: [],
      cardSizes: [],
      languages: [{ slug: "EN", label: "English", sortOrder: 0 }],
    },
  }),
} as CatalogResponse;

const PRICES: Record<string, number> = { "garen-1": 0.5, "garen-2": 3, "annie-1": 12, "jinx-1": 1 };

function source(overrides: Partial<CatalogSearchSource> = {}): CatalogSearchSource {
  return {
    catalog,
    printings: joinCatalogPrintings(catalog),
    formats: [
      { id: "standard", name: "Constructed" },
      { id: "freeform", name: "Freeform" },
    ],
    prices: {
      get: (printingId, marketplace) =>
        marketplace === "tcgplayer" ? PRICES[printingId] : undefined,
      has: (printingId) => printingId in PRICES,
    },
    ...overrides,
  };
}

function ids(q: string, extra: { cursor?: string; limit?: number } = {}) {
  const result = runCatalogSearch(source(), { q, ...extra });
  if (!result.ok) {
    throw new Error(JSON.stringify(result.diagnostics));
  }
  return result.response.printingIds;
}

describe("runCatalogSearch", () => {
  it("returns every matching printing with unique:prints, in set and number order", () => {
    expect(ids("d:fury unique:prints")).toEqual(["garen-1", "garen-2", "annie-1"]);
  });

  it("searches bare words in every field", () => {
    expect(ids("jinx")).toEqual(["jinx-1"]);
  });

  it("returns one printing per card by default", () => {
    expect(ids("d:fury")).toEqual(["garen-1", "annie-1"]);
  });

  it("picks the printing that represents a card with prefer:", () => {
    expect(ids("garen prefer:usd-low")).toEqual(["garen-1"]);
    expect(ids("garen prefer:eur-low")).toEqual(["garen-1"]);
    expect(ids("garen order:price direction:desc unique:prints")).toEqual(["garen-2", "garen-1"]);
  });

  it("applies order and direction from the query", () => {
    expect(ids("t:unit order:energy direction:desc unique:cards")).toEqual(["garen-1", "jinx-1"]);
  });

  it("sorts by TCGplayer price for order:price", () => {
    expect(ids("order:price direction:desc unique:prints")).toEqual([
      "annie-1",
      "garen-2",
      "jinx-1",
      "garen-1",
    ]);
  });

  it("filters by usd", () => {
    expect(ids("usd<2")).toEqual(["garen-1", "jinx-1"]);
  });

  it("keeps banned cards out of f:", () => {
    expect(ids("f:constructed unique:cards")).toEqual(["garen-1", "jinx-1"]);
    expect(ids("f:standard unique:cards")).toEqual(["garen-1", "jinx-1"]);
  });

  it("returns the cards and sets the page references", () => {
    const result = runCatalogSearch(source(), { q: "annie" });
    expect(result.ok && result.response).toMatchObject({
      total: 1,
      nextCursor: null,
      printingIds: ["annie-1"],
      printings: { "annie-1": catalog.printings["annie-1"] },
      cards: { annie: catalog.cards.annie },
      sets: [catalog.sets[1]],
    });
  });

  it("pages with a cursor", () => {
    const first = runCatalogSearch(source(), { q: "e>=0 unique:prints", limit: 2 });
    expect(first.ok && first.response).toMatchObject({
      total: 4,
      nextCursor: "2",
      printingIds: ["garen-1", "garen-2"],
    });
    expect(ids("e>=0 unique:prints", { cursor: "2", limit: 2 })).toEqual(["jinx-1", "annie-1"]);
  });

  describe("refusals", () => {
    function codes(q: string, extra: { cursor?: string } = {}) {
      const result = runCatalogSearch(source(), { q, ...extra });
      return result.ok ? [] : result.diagnostics.map((diagnostic) => diagnostic.code);
    }

    it("refuses a malformed value", () => {
      expect(codes("e<=x")).toEqual(["badValue"]);
    });

    it("refuses an unknown slug", () => {
      expect(codes("d:purple")).toEqual(["unknownValue"]);
    });

    it("refuses keys that need a signed-in viewer", () => {
      expect(codes("price<5 owned>=1 ctag:aggro")).toEqual([
        "unsupportedKey",
        "unsupportedKey",
        "unsupportedKey",
      ]);
    });

    it("refuses a cursor that is not a number", () => {
      expect(codes("t:unit", { cursor: "abc" })).toEqual(["badCursor"]);
    });

    it("refuses a query with too many nodes", () => {
      const q = Array.from({ length: SEARCH_MAX_NODES + 1 }, (_, index) => `w${index}`).join(" ");
      expect(codes(q)).toEqual(["tooComplex"]);
    });

    it("lets an unknown key through as text", () => {
      expect(codes("foo:bar")).toEqual([]);
    });
  });
});

describe("randomCard", () => {
  it("picks one card among the matches", () => {
    const result = randomCard(source(), "d:chaos", () => 0.99);
    expect(result?.ok && result.response.printingIds).toEqual(["annie-1"]);
  });

  it("picks from every card without a query", () => {
    const result = randomCard(source(), undefined, () => 0);
    expect(result?.ok && result.response.printingIds).toEqual(["garen-1"]);
  });

  it("returns null when nothing matches and refuses a broken query", () => {
    expect(randomCard(source(), "d:calm")).toBeNull();
    expect(randomCard(source(), "e<=x")).toMatchObject({ ok: false });
  });
});

describe("namedCard", () => {
  const index = buildNamedCardIndex(catalog, joinCatalogPrintings(catalog));

  it("finds every printing of an exact name, ignoring case", () => {
    expect(namedCard(source(), index, { exact: "garen" })?.printingIds).toEqual([
      "garen-1",
      "garen-2",
    ]);
  });

  it("requires the full name for exact", () => {
    expect(namedCard(source(), index, { exact: "gar" })).toBeNull();
  });

  it("finds the best match for a partial name with fuzzy", () => {
    expect(namedCard(source(), index, { fuzzy: "jin" })?.printingIds).toEqual(["jinx-1"]);
    expect(namedCard(source(), index, { fuzzy: "zzz" })).toBeNull();
  });
});

describe("queryReadsPrices", () => {
  it("is true for usd, eur and order:price only", () => {
    expect(queryReadsPrices(parseSearchQuery("usd<5"))).toBe(true);
    expect(queryReadsPrices(parseSearchQuery("eur<5"))).toBe(true);
    expect(queryReadsPrices(parseSearchQuery("order:price"))).toBe(true);
    expect(queryReadsPrices(parseSearchQuery("t:unit"))).toBe(false);
  });
});
