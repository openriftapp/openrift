import { filterCards } from "@openrift/shared/filters";
import type { Printing, PrintingDistributionChannel } from "@openrift/shared/types/catalog";
import type { Domain } from "@openrift/shared/types/enums";
import { PRESENCE_DIMENSIONS } from "@openrift/shared/types/search";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ navigate: vi.fn() }),
}));

import { useFilterValues } from "@/features/cards/hooks/use-card-filters";
import { FilterSearchProvider } from "@/features/cards/hooks/use-filter-search";
import { searchToFilters } from "@/features/cards/lib/cards-facets";
import type { ActiveFilterChip } from "@/features/cards/lib/filter-dimensions";
import {
  ACTIVE_FILTER_CHIPS,
  CLEARABLE_FILTER_PARAMS,
  dimensionParams,
  FILTER_DIMENSIONS,
  KEPT_FILTER_PARAMS,
  PRESENCE_PARAMS,
  PRESENCE_VALUE_PARAMS,
  toFilterState,
} from "@/features/cards/lib/filter-dimensions";
import { filterSearchSchema } from "@/features/cards/lib/search-schemas";
import { HIDDEN_FILTER_SECTIONS } from "@/features/collections/hooks/use-stats-scope";
import { buildMissingSearch } from "@/features/collections/lib/stats-missing-search";
import { scopeFromFilters, statsScopePredicate } from "@/features/collections/lib/stats-scope";
import { stubPrinting } from "@/test/factories";

const NON_DIMENSION_PARAMS = ["q", "sort", "sortDir", "view", "groupBy", "groupDir"];

const HIDDEN_ON_STATS = "The collection stats page hides this filter section.";

const NOT_APPLICABLE: Record<
  string,
  Partial<Record<"chips" | "predicate" | "ssr" | "stats", string>>
> = {
  languages: {
    chips: "The language picker shows the selection, and clear-all keeps it.",
  },
  "customTags.customTags": {
    ssr: "The public SSR catalog has no per-user custom-tag assignments.",
  },
  owned: {
    predicate: "Ownership comes from the viewer's copies; use-card-data applies it.",
    stats: HIDDEN_ON_STATS,
  },
  copies: {
    predicate: "Ownership comes from the viewer's copies; use-card-data applies it.",
    stats: HIDDEN_ON_STATS,
  },
  superTypes: { stats: HIDDEN_ON_STATS },
  promo: { stats: HIDDEN_ON_STATS },
  markers: { stats: HIDDEN_ON_STATS },
  channels: { stats: HIDDEN_ON_STATS },
  energy: { stats: HIDDEN_ON_STATS },
  might: { stats: HIDDEN_ON_STATS },
  power: { stats: HIDDEN_ON_STATS },
  price: { stats: HIDDEN_ON_STATS },
  noImage: { stats: HIDDEN_ON_STATS },
};

const PARAM_SAMPLES: Record<string, unknown> = {
  languages: ["DE"],
  languagesEx: ["DE"],
  sets: ["RB2"],
  setsEx: ["RB2"],
  domains: ["calm"],
  domainsEx: ["calm"],
  rarities: ["rare"],
  raritiesEx: ["rare"],
  types: ["spell"],
  typesEx: ["spell"],
  superTypes: ["champion"],
  superTypesEx: ["champion"],
  superTypesPresence: "any",
  artVariants: ["altart"],
  artVariantsEx: ["altart"],
  finishes: ["foil"],
  finishesEx: ["foil"],
  overnumbered: true,
  signed: true,
  standard: true,
  markersPresence: "any",
  energyMin: 3,
  energyMax: 3,
  powerMin: 3,
  powerMax: 3,
  mightMin: 3,
  mightMax: 3,
  markers: ["nexus"],
  markersEx: ["nexus"],
  cardSizes: ["oversized"],
  channels: ["store"],
  channelsEx: ["store"],
  channelsPresence: "any",
  customTags: ["staple"],
  customTagsEx: ["staple"],
  customTagsPresence: "any",
  tags: ["Poro"],
  tagsEx: ["Poro"],
  tagsPresence: "any",
  keywords: ["Unique"],
  keywordsEx: ["Unique"],
  keywordsPresence: "any",
  banned: true,
  errata: true,
  noImage: true,
  owned: ["partial"],
  ownedCountMin: 1,
  ownedCountMax: 1,
  priceMin: 5,
  priceMax: 5,
};

const STORE_CHANNEL = {
  channel: { slug: "store" },
  distributionNote: null,
  ancestorLabels: [],
} as unknown as PrintingDistributionChannel;

const FIXTURES: Printing[] = [
  stubPrinting({
    printingId: "plain",
    cardId: "c-plain",
    setSlug: "RB1",
    language: "EN",
    rarity: "common",
    finish: "normal",
    artVariant: "normal",
    size: "standard",
    images: [{ imageId: "image-1" }] as Printing["images"],
    card: {
      domains: ["fury"] as Domain[],
      types: ["unit"],
      superTypes: [],
      keywords: [],
      tags: [],
      energy: 1,
      might: 1,
      power: 1,
      bans: [],
      errata: [],
    },
  }),
  stubPrinting({
    printingId: "special",
    cardId: "c-special",
    setSlug: "RB2",
    language: "DE",
    rarity: "rare",
    finish: "foil",
    artVariant: "altart",
    size: "oversized",
    isSigned: true,
    isOvernumbered: true,
    images: [],
    markers: [{ id: "m-1", slug: "nexus", label: "Nexus", description: null }],
    distributionChannels: [STORE_CHANNEL],
    card: {
      domains: ["calm"] as Domain[],
      types: ["spell"],
      superTypes: ["champion"],
      keywords: ["Unique"],
      tags: ["Poro"],
      energy: 5,
      might: 5,
      power: 5,
      bans: [{ formatId: "f", formatName: "Standard", bannedAt: "2025-01-01", reason: null }],
      errata: [
        {
          language: "DE",
          correctedRulesText: "x",
          correctedEffectText: null,
          source: "s",
          sourceUrl: null,
          effectiveDate: null,
        },
      ],
    },
  }),
];

const CUSTOM_TAGS: Record<string, readonly string[]> = { "c-special": ["staple"] };
const PRICES: Record<string, number> = { plain: 1, special: 10 };

function filtersFor(search: Record<string, unknown>) {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(FilterSearchProvider, { value: search }, children);
  return renderHook(() => useFilterValues(), { wrapper }).result.current.filters;
}

function matchedIds(search: Record<string, unknown>): string[] {
  return filterCards(FIXTURES, filtersFor(search), {
    customTagAssignments: CUSTOM_TAGS,
    getPrice: (printing) => PRICES[printing.printingId],
  }).map((printing) => printing.printingId);
}

function chipParams(chip: ActiveFilterChip): string[] {
  switch (chip.kind) {
    case "range": {
      return [`${chip.range}Min`, `${chip.range}Max`];
    }
    case "copies": {
      return ["ownedCountMin", "ownedCountMax"];
    }
    case "presence": {
      return [PRESENCE_PARAMS[chip.dimension]];
    }
    default: {
      return [chip.param];
    }
  }
}

const DIMENSION_PARAMS = FILTER_DIMENSIONS.flatMap((dimension) =>
  dimensionParams(dimension).map((param) => ({ dimension, param })),
);
const CASES = DIMENSION_PARAMS.map(({ dimension, param }) => [
  `${dimension.key}.${param}`,
  dimension,
  param,
]) as [string, (typeof FILTER_DIMENSIONS)[number], string][];

describe("filter dimension coverage", () => {
  it("gives every URL filter param exactly one dimension", () => {
    const schemaParams = Object.keys(filterSearchSchema._zod.def.shape).toSorted();
    const owned = DIMENSION_PARAMS.map(({ param }) => param);
    expect(new Set(owned).size).toBe(owned.length);
    expect([...owned, ...NON_DIMENSION_PARAMS].toSorted()).toEqual(schemaParams);
  });

  it("keeps only languages through clear-all", () => {
    expect(KEPT_FILTER_PARAMS).toEqual(["languages", "languagesEx"]);
    expect([...CLEARABLE_FILTER_PARAMS, ...KEPT_FILTER_PARAMS].toSorted()).toEqual(
      ["q", ...DIMENSION_PARAMS.map(({ param }) => param)].toSorted(),
    );
  });

  it("links every presence dimension to its presence and value params", () => {
    for (const dimension of PRESENCE_DIMENSIONS) {
      expect(PRESENCE_PARAMS[dimension], dimension).toBeDefined();
      expect(PRESENCE_VALUE_PARAMS[dimension]?.include, dimension).toBeDefined();
    }
  });

  it("maps every chip to a dimension param", () => {
    const params = new Set<string>(DIMENSION_PARAMS.map(({ param }) => param));
    for (const chip of ACTIVE_FILTER_CHIPS) {
      for (const param of chipParams(chip)) {
        expect(params.has(param), param).toBe(true);
      }
    }
  });

  it.each(CASES)("%s is parsed into the filter state", (_name, _dimension, param) => {
    expect(toFilterState({}, "cards", "id", "asc", "set", "asc")).toHaveProperty(param);
    const parsed = filterSearchSchema.parse({ [param]: PARAM_SAMPLES[param] });
    expect(parsed[param as keyof typeof parsed]).toEqual(PARAM_SAMPLES[param]);
  });

  it.each(CASES)("%s has an active-filter chip", (_name, dimension, param) => {
    const reason = NOT_APPLICABLE[dimension.key]?.chips;
    const covered = ACTIVE_FILTER_CHIPS.some((chip) => chipParams(chip).includes(param));
    expect(covered).toBe(reason === undefined);
  });

  it.each(CASES)("%s narrows the shared card predicate", (_name, dimension, param) => {
    const reason = NOT_APPLICABLE[dimension.key]?.predicate;
    const all = FIXTURES.map((printing) => printing.printingId);
    const matched = matchedIds({ [param]: PARAM_SAMPLES[param] });
    if (reason === undefined) {
      expect(matched).not.toEqual(all);
    } else {
      expect(matched).toEqual(all);
    }
  });

  it.each(CASES)("%s is parsed the same by the SSR facet counts", (name, dimension, param) => {
    const search = { [param]: PARAM_SAMPLES[param] };
    const ssr = filterCards(FIXTURES, searchToFilters(search), {
      customTagAssignments: CUSTOM_TAGS,
      getPrice: (printing) => PRICES[printing.printingId],
    }).map((printing) => printing.printingId);
    const reason = NOT_APPLICABLE[name]?.ssr ?? NOT_APPLICABLE[dimension.key]?.ssr;
    if (reason === undefined) {
      expect(ssr).toEqual(matchedIds(search));
    } else {
      expect(ssr).not.toEqual(matchedIds(search));
    }
  });

  it("lists exactly the dimensions the stats page hides as not applicable to stats", () => {
    const hidden = FILTER_DIMENSIONS.filter((dimension) =>
      HIDDEN_FILTER_SECTIONS.has(dimension.section),
    ).map((dimension) => dimension.key);
    const listed = FILTER_DIMENSIONS.filter(
      (dimension) => NOT_APPLICABLE[dimension.key]?.stats !== undefined,
    ).map((dimension) => dimension.key);
    expect(listed).toEqual(hidden);
  });

  it.each(CASES.filter(([, dimension]) => NOT_APPLICABLE[dimension.key]?.stats === undefined))(
    "%s narrows the collection stats scope like the card predicate",
    (_name, _dimension, param) => {
      const scope = scopeFromFilters(filtersFor({ [param]: PARAM_SAMPLES[param] }));
      expect(scope).not.toEqual({});
      const scoped = FIXTURES.filter(statsScopePredicate(scope, CUSTOM_TAGS)).map(
        (printing) => printing.printingId,
      );
      expect(scoped).toEqual(matchedIds({ [param]: PARAM_SAMPLES[param] }));
    },
  );

  it.each(CASES.filter(([, dimension]) => NOT_APPLICABLE[dimension.key]?.stats === undefined))(
    "%s carries into the stats page's View missing link",
    (_name, _dimension, param) => {
      const scope = scopeFromFilters(filtersFor({ [param]: PARAM_SAMPLES[param] }));
      const search = buildMissingSearch({
        countMode: "cards",
        groupBy: "set",
        key: "unknown-set",
        scope,
        setIdToSlug: new Map(),
      });
      expect(search?.[param as keyof typeof search]).toEqual(PARAM_SAMPLES[param]);
    },
  );
});
