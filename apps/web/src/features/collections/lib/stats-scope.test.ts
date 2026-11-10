import { cardFiltersPredicate } from "@openrift/shared/filters";
import type { CompletionScopePreference } from "@openrift/shared/types/api/preferences";
import type { Card, Printing } from "@openrift/shared/types/catalog";
import type { CardType, Domain } from "@openrift/shared/types/enums";
import type { CardFilters } from "@openrift/shared/types/search";
import { EMPTY_CARD_FILTERS } from "@openrift/shared/types/search";
import { describe, expect, it } from "vitest";

import { searchToFilters } from "@/features/cards/lib/cards-facets";
import type { FilterSearch } from "@/features/cards/lib/search-schemas";
import type { CompletionGroupBy } from "@/features/collections/lib/stat-types";
import { stubPrinting } from "@/test/factories";

import { buildMissingSearch } from "./stats-missing-search";
import { scopeFromFilters, scopeToCardFilters, statsScopePredicate } from "./stats-scope";

const PROMO = { id: "m-1", slug: "nexus", label: "Nexus", description: null };
const BAN = { formatId: "f", formatName: "Standard", bannedAt: "2025-01-01", reason: null };
const ERRATA_EN = {
  language: "EN",
  correctedRulesText: "x",
  correctedEffectText: null,
  source: "s",
  sourceUrl: null,
  effectiveDate: null,
};

function fixture(
  index: number,
  overrides: Omit<Partial<Printing>, "card"> & { card?: Partial<Card> },
): Printing {
  return stubPrinting({
    printingId: `p${index}`,
    cardId: `c${index}`,
    setSlug: "RB1",
    language: "EN",
    rarity: "common",
    finish: "normal",
    artVariant: "normal",
    size: "standard",
    isSigned: false,
    isOvernumbered: false,
    markers: [],
    ...overrides,
    card: {
      domains: ["fury"] as Domain[],
      types: ["unit"],
      superTypes: [],
      keywords: [],
      tags: [],
      bans: [],
      errata: [],
      ...overrides.card,
    },
  });
}

const PRINTINGS: Printing[] = [
  fixture(0, {}),
  fixture(1, { setSlug: "RB2", language: "DE", rarity: "rare", finish: "foil" }),
  fixture(2, { language: "FR", rarity: "showcase", artVariant: "altart" }),
  fixture(3, { artVariant: "overnumbered", isOvernumbered: true, rarity: "epic" }),
  fixture(4, { size: "oversized", isSigned: true }),
  fixture(5, { markers: [PROMO], finish: "foil" }),
  fixture(6, { card: { domains: ["fury", "calm"] as Domain[] } }),
  fixture(7, { card: { domains: ["calm", "mind"] as Domain[], types: ["spell"] } }),
  fixture(8, { card: { domains: [] as Domain[], types: ["gear", "unit"] } }),
  fixture(9, { card: { keywords: ["Unique"], tags: ["Poro"] } }),
  fixture(10, { card: { keywords: ["Deflect", "Unique"], tags: ["Poro", "Yordle"] } }),
  fixture(11, { card: { bans: [BAN] } }),
  fixture(12, { card: { errata: [ERRATA_EN] } }),
  fixture(13, { language: "DE", card: { errata: [ERRATA_EN] } }),
  fixture(14, { setSlug: "RB2", rarity: "uncommon", card: { superTypes: ["champion"] } }),
  fixture(15, { finish: "foil", rarity: "rare" }),
];

const CUSTOM_TAGS: Record<string, readonly string[]> = {
  c0: ["staple"],
  c6: ["staple", "budget"],
  c9: ["budget"],
};

const SCOPES: [string, CompletionScopePreference, string][] = [
  ["empty", {}, "1111111111111111"],
  ["empty arrays", { sets: [], domains: [], setsExclude: [] }, "1111111111111111"],
  ["sets", { sets: ["RB2"] }, "0100000000000010"],
  ["sets multi", { sets: ["RB1", "RB2"] }, "1111111111111111"],
  ["languages", { languages: ["DE", "FR"] }, "0110000000000100"],
  ["domains one", { domains: ["calm"] }, "0000001100000000"],
  ["domains two", { domains: ["fury", "mind"] }, "1111110011111111"],
  ["domains colorless", { domains: ["colorless"] }, "0000000000000000"],
  ["types", { types: ["unit"] }, "1111111011111111"],
  ["types multi", { types: ["spell", "gear"] }, "0000000110000000"],
  ["rarities", { rarities: ["rare", "epic"] }, "0101000000000001"],
  ["finishes", { finishes: ["foil"] }, "0100010000000001"],
  ["artVariants", { artVariants: ["altart", "overnumbered"] }, "0011000000000000"],
  ["keywords", { keywords: ["Unique"] }, "0000000001100000"],
  ["tags", { tags: ["Yordle", "Poro"] }, "0000000001100000"],
  ["customTags", { customTags: ["staple"] }, "1000001000000000"],
  ["cardSizes", { cardSizes: ["oversized"] }, "0000100000000000"],
  ["standard on", { standard: true }, "1100001111111111"],
  ["standard off", { standard: false }, "0011110000000000"],
  ["keywordsPresence any", { keywordsPresence: "any" }, "0000000001100000"],
  ["keywordsPresence none", { keywordsPresence: "none" }, "1111111110011111"],
  ["tagsPresence any", { tagsPresence: "any" }, "0000000001100000"],
  ["tagsPresence none", { tagsPresence: "none" }, "1111111110011111"],
  ["customTagsPresence any", { customTagsPresence: "any" }, "1000001001000000"],
  ["customTagsPresence none", { customTagsPresence: "none" }, "0111110110111111"],
  ["setsExclude", { setsExclude: ["RB2"] }, "1011111111111101"],
  ["languagesExclude", { languagesExclude: ["EN"] }, "0110000000000100"],
  ["domainsExclude", { domainsExclude: ["calm"] }, "1111110011111111"],
  ["typesExclude", { typesExclude: ["unit"] }, "0000000100000000"],
  ["raritiesExclude", { raritiesExclude: ["common", "rare"] }, "0011000000000010"],
  ["finishesExclude", { finishesExclude: ["normal"] }, "0100010000000001"],
  ["artVariantsExclude", { artVariantsExclude: ["normal"] }, "0011000000000000"],
  ["keywordsExclude", { keywordsExclude: ["Deflect"] }, "1111111111011111"],
  ["tagsExclude", { tagsExclude: ["Poro"] }, "1111111110011111"],
  ["customTagsExclude", { customTagsExclude: ["budget"] }, "1111110110111111"],
  ["promos only", { promos: "only" }, "0000010000000000"],
  ["promos exclude", { promos: "exclude" }, "1111101111111111"],
  ["signed on", { signed: true }, "0000100000000000"],
  ["signed off", { signed: false }, "1111011111111111"],
  ["overnumbered on", { overnumbered: true }, "0001000000000000"],
  ["overnumbered off", { overnumbered: false }, "1110111111111111"],
  ["banned on", { banned: true }, "0000000000010000"],
  ["banned off", { banned: false }, "1111111111101111"],
  ["errata on", { errata: true }, "0000000000001000"],
  ["errata off", { errata: false }, "1111111111110111"],
  ["include and exclude", { sets: ["RB1"], raritiesExclude: ["common"] }, "0011000000000001"],
  [
    "include and exclude same axis",
    { domains: ["fury", "calm"], domainsExclude: ["mind"] },
    "1111111011111111",
  ],
  [
    "many axes",
    {
      languages: ["EN"],
      types: ["unit"],
      finishes: ["normal"],
      customTagsExclude: ["budget"],
      promos: "exclude",
      banned: false,
    },
    "1001100010101010",
  ],
];

function matchRow(predicate: (printing: Printing) => boolean): string {
  return PRINTINGS.map((printing) => (predicate(printing) ? "1" : "0")).join("");
}

describe("statsScopePredicate", () => {
  it.each(SCOPES)("keeps the stats page's matches for %s", (_name, scope, expected) => {
    expect(matchRow(statsScopePredicate(scope, CUSTOM_TAGS))).toBe(expected);
  });

  it("keeps a card on two selected domains only when all its domains are selected", () => {
    expect(matchRow(statsScopePredicate({ domains: ["fury", "mind"] })).slice(6, 9)).toBe("001");
    expect(matchRow(statsScopePredicate({ domains: ["fury", "calm"] })).slice(6, 9)).toBe("101");
  });
});

const SET_IDS = new Map([
  ["set-rb1", "RB1"],
  ["set-rb2", "RB2"],
]);
const VOCABULARY = { domain: ["fury", "calm", "mind", "body", "chaos", "order", "colorless"] };

function statsRowCardIds(
  scope: CompletionScopePreference,
  groupBy: CompletionGroupBy,
  key: string,
) {
  const inRow = (printing: Printing) => {
    switch (groupBy) {
      case "set": {
        return `set-${printing.setSlug.toLowerCase()}` === key;
      }
      case "domain": {
        return printing.card.domains.includes(key as Domain);
      }
      case "rarity": {
        return printing.rarity === key;
      }
      case "type": {
        return printing.card.types.includes(key as CardType);
      }
    }
  };
  const inScope = statsScopePredicate(scope);
  return [...new Set(PRINTINGS.filter((p) => inScope(p) && inRow(p)).map((p) => p.cardId))];
}

function missingLinkCardIds(
  scope: CompletionScopePreference,
  groupBy: CompletionGroupBy,
  key: string,
) {
  const search = buildMissingSearch({
    countMode: "cards",
    groupBy,
    key,
    scope,
    setIdToSlug: SET_IDS,
  });
  const filters = searchToFilters(search as FilterSearch);
  const matches = cardFiltersPredicate(filters, { vocabulary: VOCABULARY });
  return [...new Set(PRINTINGS.filter((p) => matches(p)).map((p) => p.cardId))];
}

describe("stats rows and their View missing link", () => {
  const ROWS: [CompletionScopePreference, CompletionGroupBy, string][] = [
    [{ domains: ["fury", "mind"] }, "set", "set-rb1"],
    [{ domains: ["fury", "mind"] }, "rarity", "common"],
    [{ domains: ["fury", "mind"] }, "type", "unit"],
    [{ domains: ["fury", "mind"] }, "domain", "fury"],
    [{ domains: ["fury", "mind"] }, "domain", "mind"],
    [{ domains: ["fury", "calm"] }, "domain", "calm"],
    [{ domains: ["fury", "calm"], domainsExclude: ["mind"] }, "domain", "fury"],
    [{ domains: ["calm"] }, "domain", "fury"],
    [{ domains: ["calm"] }, "domain", "calm"],
    [{}, "domain", "calm"],
  ];

  it.each(ROWS)("agree for scope %j grouped by %s, row %s", (scope, groupBy, key) => {
    expect(missingLinkCardIds(scope, groupBy, key)).toEqual(statsRowCardIds(scope, groupBy, key));
  });
});

const FULL_FILTERS: CardFilters = {
  ...EMPTY_CARD_FILTERS,
  search: "t:unit",
  sets: ["RB1"],
  languages: ["EN"],
  rarities: ["rare"],
  types: ["unit"],
  superTypes: ["champion"],
  domains: ["fury"],
  energy: { min: 1, max: 3 },
  might: { min: 1, max: null },
  power: { min: null, max: 2 },
  price: { min: 1, max: 5 },
  artVariants: ["normal"],
  finishes: ["foil"],
  cardSizes: ["standard"],
  isSigned: false,
  isOvernumbered: true,
  presence: {
    markers: "none",
    superTypes: "any",
    customTags: "any",
    distributionChannels: "none",
    keywords: "any",
    tags: "none",
  },
  markerSlugs: ["nexus"],
  distributionChannelSlugs: ["store"],
  customTagSlugs: ["staple"],
  keywords: ["Unique"],
  tags: ["Poro"],
  isBanned: true,
  hasErrata: false,
  hasNoImage: true,
  setsExclude: ["RB2"],
  languagesExclude: ["DE"],
  raritiesExclude: ["common"],
  typesExclude: ["spell"],
  superTypesExclude: ["token"],
  domainsExclude: ["mind"],
  artVariantsExclude: ["altart"],
  finishesExclude: ["normal"],
  markerSlugsExclude: ["promo"],
  distributionChannelSlugsExclude: ["event"],
  customTagSlugsExclude: ["budget"],
  keywordsExclude: ["Deflect"],
  tagsExclude: ["Yordle"],
  isStandard: false,
};

describe("scopeFromFilters", () => {
  it("returns an empty scope for empty filters", () => {
    expect(scopeFromFilters(EMPTY_CARD_FILTERS)).toStrictEqual({});
  });

  it("drops the sections the stats page hides and keeps the scope's key order", () => {
    const scope = scopeFromFilters(FULL_FILTERS);
    expect(scope).toStrictEqual({
      sets: ["RB1"],
      languages: ["EN"],
      domains: ["fury"],
      types: ["unit"],
      rarities: ["rare"],
      finishes: ["foil"],
      artVariants: ["normal"],
      keywords: ["Unique"],
      tags: ["Poro"],
      customTags: ["staple"],
      cardSizes: ["standard"],
      standard: false,
      keywordsPresence: "any",
      tagsPresence: "none",
      customTagsPresence: "any",
      setsExclude: ["RB2"],
      languagesExclude: ["DE"],
      domainsExclude: ["mind"],
      typesExclude: ["spell"],
      raritiesExclude: ["common"],
      finishesExclude: ["normal"],
      artVariantsExclude: ["altart"],
      keywordsExclude: ["Deflect"],
      tagsExclude: ["Yordle"],
      customTagsExclude: ["budget"],
      promos: "exclude",
      signed: false,
      overnumbered: true,
      banned: true,
      errata: false,
    });
    expect(Object.keys(scope).join(",")).toBe(
      "sets,languages,domains,types,rarities,finishes,artVariants,keywords,tags,customTags," +
        "cardSizes,standard,keywordsPresence,tagsPresence,customTagsPresence,setsExclude," +
        "languagesExclude,domainsExclude,typesExclude,raritiesExclude,finishesExclude," +
        "artVariantsExclude,keywordsExclude,tagsExclude,customTagsExclude,promos,signed," +
        "overnumbered,banned,errata",
    );
  });

  it("passes the filter arrays through without copying them", () => {
    const scope = scopeFromFilters(FULL_FILTERS);
    expect(scope.sets).toBe(FULL_FILTERS.sets);
    expect(scope.customTagsExclude).toBe(FULL_FILTERS.customTagSlugsExclude);
  });

  it("maps promo presence onto the promos key", () => {
    expect(scopeFromFilters({ ...EMPTY_CARD_FILTERS, presence: { markers: "any" } })).toEqual({
      promos: "only",
    });
  });

  it("round-trips through scopeToCardFilters", () => {
    const scope = scopeFromFilters(FULL_FILTERS);
    expect(scopeFromFilters(scopeToCardFilters(scope))).toStrictEqual(scope);
  });
});
