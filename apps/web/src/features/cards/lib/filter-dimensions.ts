import type { AvailableFilters } from "@openrift/shared/filters-available";
import type { DefaultCardView } from "@openrift/shared/types/api/preferences";
import type { PresenceDimension, RangeKey, SortDirection } from "@openrift/shared/types/search";

import { oversizeState } from "@/features/cards/lib/oversize-filter";
import type { PresenceParamValue } from "@/features/cards/lib/presence-filter";
import { presenceLabel, presenceToFlagState } from "@/features/cards/lib/presence-filter";
import type { FilterSearch, OwnedBucket } from "@/features/cards/lib/search-schemas";
import type { FilterCategory } from "@/lib/icons";
import { m } from "@/paraglide/messages.js";

export function ownedBucketLabel(value: string): string {
  switch (value) {
    case "none": {
      return m.cards_filter_owned_none();
    }
    case "partial": {
      return m.cards_filter_owned_partial();
    }
    case "full": {
      return m.cards_filter_owned_full();
    }
    case "extra": {
      return m.cards_filter_owned_extra();
    }
    default: {
      return value;
    }
  }
}

export function ownedBuckets(): readonly { value: OwnedBucket; label: string }[] {
  return (["none", "partial", "full", "extra"] as const).map((value) => ({
    value,
    label: ownedBucketLabel(value),
  }));
}

// Sort/group defaults are passed as primitives, not one object: a derived
// object makes React Compiler treat this call as maybe-mutated, killing memoization.
export function toFilterState(
  raw: FilterSearch,
  defaultView: DefaultCardView,
  defaultSort: string,
  defaultSortDir: SortDirection,
  defaultGroupBy: string,
  defaultGroupDir: SortDirection,
) {
  return {
    search: raw.q ?? "",
    sets: raw.sets ?? [],
    languages: raw.languages ?? [],
    rarities: raw.rarities ?? [],
    types: raw.types ?? [],
    superTypes: raw.superTypes ?? [],
    domains: raw.domains ?? [],
    artVariants: raw.artVariants ?? [],
    finishes: raw.finishes ?? [],
    cardSizes: raw.cardSizes ?? [],
    markers: raw.markers ?? [],
    channels: raw.channels ?? [],
    customTags: raw.customTags ?? [],
    keywords: raw.keywords ?? [],
    tags: raw.tags ?? [],
    setsEx: raw.setsEx ?? [],
    languagesEx: raw.languagesEx ?? [],
    raritiesEx: raw.raritiesEx ?? [],
    typesEx: raw.typesEx ?? [],
    superTypesEx: raw.superTypesEx ?? [],
    domainsEx: raw.domainsEx ?? [],
    artVariantsEx: raw.artVariantsEx ?? [],
    finishesEx: raw.finishesEx ?? [],
    markersEx: raw.markersEx ?? [],
    channelsEx: raw.channelsEx ?? [],
    customTagsEx: raw.customTagsEx ?? [],
    keywordsEx: raw.keywordsEx ?? [],
    tagsEx: raw.tagsEx ?? [],
    standard: raw.standard ?? null,
    energyMin: raw.energyMin ?? null,
    energyMax: raw.energyMax ?? null,
    mightMin: raw.mightMin ?? null,
    mightMax: raw.mightMax ?? null,
    powerMin: raw.powerMin ?? null,
    powerMax: raw.powerMax ?? null,
    priceMin: raw.priceMin ?? null,
    priceMax: raw.priceMax ?? null,
    ownedCountMin: raw.ownedCountMin ?? null,
    ownedCountMax: raw.ownedCountMax ?? null,
    owned: raw.owned ?? [],
    signed: raw.signed ?? null,
    overnumbered: raw.overnumbered ?? null,
    markersPresence: raw.markersPresence ?? null,
    superTypesPresence: raw.superTypesPresence ?? null,
    customTagsPresence: raw.customTagsPresence ?? null,
    channelsPresence: raw.channelsPresence ?? null,
    keywordsPresence: raw.keywordsPresence ?? null,
    tagsPresence: raw.tagsPresence ?? null,
    banned: raw.banned ?? null,
    errata: raw.errata ?? null,
    noImage: raw.noImage ?? null,
    sort: raw.sort ?? defaultSort,
    sortDir: raw.sortDir ?? defaultSortDir,
    view: raw.view ?? defaultView,
    groupBy: raw.groupBy ?? defaultGroupBy,
    groupDir: raw.groupDir ?? defaultGroupDir,
  };
}

export type FilterDimensionState = ReturnType<typeof toFilterState>;

export interface FilterDimensionAvailability {
  availableFilters: AvailableFilters;
  availableLanguages?: string[];
  customTagCategoryCount: number;
  ownedCountMax?: number;
}

export interface FilterDimensionLabels {
  language: (code: string) => string;
  set: (code: string) => string;
  domain: (slug: string) => string;
  rarity: (slug: string) => string;
  type: (slug: string) => string;
  superType: (slug: string) => string;
  artVariant: (slug: string) => string;
  finish: (slug: string) => string;
  marker: (slug: string) => string;
  channel: (slug: string) => string;
  customTag: (slug: string) => string;
  ownedBucket: (value: string) => string;
}

type FilterParam = keyof FilterSearch;

type FilterParamOfType<T> = {
  [K in FilterParam]-?: NonNullable<FilterSearch[K]> extends T ? K : never;
}[FilterParam];

export type ArrayFilterParam = FilterParamOfType<readonly string[]>;
export type FlagFilterParam = FilterParamOfType<boolean>;
type PresenceFilterParam = Extract<FilterParam, `${string}Presence`>;
type RangeFilterParam = FilterParamOfType<number>;

interface FilterDimensionParams {
  include?: ArrayFilterParam;
  exclude?: ArrayFilterParam;
  presence?: PresenceFilterParam;
  flag?: FlagFilterParam;
  min?: RangeFilterParam;
  max?: RangeFilterParam;
}

export interface FilterDimension {
  key: string;
  unit: string;
  section: string;
  params: FilterDimensionParams;
  presenceDimension?: PresenceDimension;
  keptOnClear?: true;
  hasContent: (input: FilterDimensionAvailability) => boolean;
  activeCount: (state: FilterDimensionState) => number;
  activeLabels: (state: FilterDimensionState, labels: FilterDimensionLabels) => string[];
}

function valueLabels(
  included: readonly string[],
  excluded: readonly string[],
  labelFor: (value: string) => string,
): string[] {
  return [
    ...included.map((value) => labelFor(value)),
    ...excluded.map((value) => `−${labelFor(value)}`),
  ];
}

function flagLabels(state: boolean | null, label: string): string[] {
  if (state === null) {
    return [];
  }
  return [state === false ? `−${label}` : label];
}

function presenceLabels(dimension: PresenceDimension, value: PresenceParamValue): string[] {
  if (value === null) {
    return [];
  }
  const label = presenceLabel(dimension);
  return [value === "none" ? `−${label}` : label];
}

function rangeCount(min: number | null, max: number | null): number {
  return min !== null || max !== null ? 1 : 0;
}

function setCount(value: unknown): number {
  return value === null ? 0 : 1;
}

export const FILTER_DIMENSIONS: readonly FilterDimension[] = [
  {
    key: "languages",
    params: { include: "languages", exclude: "languagesEx" },
    keptOnClear: true,
    unit: "languages",
    section: "languages",
    hasContent: ({ availableLanguages }) => (availableLanguages?.length ?? 0) > 1,
    activeCount: (s) => s.languages.length + s.languagesEx.length,
    activeLabels: (s, l) => valueLabels(s.languages, s.languagesEx, l.language),
  },
  {
    key: "sets",
    params: { include: "sets", exclude: "setsEx" },
    unit: "sets",
    section: "sets",
    hasContent: ({ availableFilters }) => availableFilters.sets.length > 0,
    activeCount: (s) => s.sets.length + s.setsEx.length,
    activeLabels: (s, l) => valueLabels(s.sets, s.setsEx, l.set),
  },
  {
    key: "domains",
    params: { include: "domains", exclude: "domainsEx" },
    unit: "domains",
    section: "domains",
    hasContent: ({ availableFilters }) => availableFilters.domains.length > 0,
    activeCount: (s) => s.domains.length + s.domainsEx.length,
    activeLabels: (s, l) => valueLabels(s.domains, s.domainsEx, l.domain),
  },
  {
    key: "rarities",
    params: { include: "rarities", exclude: "raritiesEx" },
    unit: "rarities",
    section: "rarities",
    hasContent: ({ availableFilters }) => availableFilters.rarities.length > 0,
    activeCount: (s) => s.rarities.length + s.raritiesEx.length,
    activeLabels: (s, l) => valueLabels(s.rarities, s.raritiesEx, l.rarity),
  },
  {
    key: "types",
    params: { include: "types", exclude: "typesEx" },
    unit: "types",
    section: "types",
    hasContent: ({ availableFilters }) => availableFilters.types.length > 0,
    activeCount: (s) => s.types.length + s.typesEx.length,
    activeLabels: (s, l) => valueLabels(s.types, s.typesEx, l.type),
  },
  {
    key: "superTypes",
    params: { include: "superTypes", exclude: "superTypesEx", presence: "superTypesPresence" },
    presenceDimension: "superTypes",
    unit: "superTypes",
    section: "superTypes",
    hasContent: ({ availableFilters }) => availableFilters.superTypes.length > 0,
    activeCount: (s) =>
      s.superTypes.length + s.superTypesEx.length + setCount(s.superTypesPresence),
    activeLabels: (s, l) => [
      ...valueLabels(s.superTypes, s.superTypesEx, l.superType),
      ...presenceLabels("superTypes", s.superTypesPresence),
    ],
  },
  {
    key: "artVariants",
    params: { include: "artVariants", exclude: "artVariantsEx" },
    unit: "variant",
    section: "artVariants",
    hasContent: ({ availableFilters }) => availableFilters.artVariants.length > 1,
    activeCount: (s) => s.artVariants.length + s.artVariantsEx.length,
    activeLabels: (s, l) => valueLabels(s.artVariants, s.artVariantsEx, l.artVariant),
  },
  {
    key: "finishes",
    params: { include: "finishes", exclude: "finishesEx" },
    unit: "variant",
    section: "finishes",
    hasContent: ({ availableFilters }) => availableFilters.finishes.length > 1,
    activeCount: (s) => s.finishes.length + s.finishesEx.length,
    activeLabels: (s, l) => valueLabels(s.finishes, s.finishesEx, l.finish),
  },
  {
    key: "overnumbered",
    params: { flag: "overnumbered" },
    unit: "variant",
    section: "overnumbered",
    hasContent: ({ availableFilters }) => availableFilters.hasOvernumbered,
    activeCount: (s) => setCount(s.overnumbered),
    activeLabels: (s) => flagLabels(s.overnumbered, m.cards_filter_flag_overnumbered()),
  },
  {
    key: "signed",
    params: { flag: "signed" },
    unit: "variant",
    section: "signed",
    hasContent: ({ availableFilters }) => availableFilters.hasSigned,
    activeCount: (s) => setCount(s.signed),
    activeLabels: (s) => flagLabels(s.signed, m.cards_filter_flag_signed()),
  },
  {
    key: "standard",
    params: { flag: "standard" },
    unit: "standard",
    section: "standard",
    hasContent: ({ availableFilters }) => availableFilters.hasNonStandard,
    activeCount: (s) => setCount(s.standard),
    activeLabels: (s) => flagLabels(s.standard, m.cards_filter_flag_standard()),
  },
  {
    key: "promo",
    params: { presence: "markersPresence" },
    presenceDimension: "markers",
    unit: "promo",
    section: "promo",
    hasContent: ({ availableFilters }) => availableFilters.markers.length > 0,
    activeCount: (s) => setCount(s.markersPresence),
    activeLabels: (s) =>
      flagLabels(presenceToFlagState(s.markersPresence), m.cards_filter_flag_promo()),
  },
  {
    key: "energy",
    params: { min: "energyMin", max: "energyMax" },
    unit: "stats",
    section: "energy",
    hasContent: () => true,
    activeCount: (s) => rangeCount(s.energyMin, s.energyMax),
    activeLabels: (s) =>
      rangeCount(s.energyMin, s.energyMax) ? [m.cards_filter_range_energy()] : [],
  },
  {
    key: "power",
    params: { min: "powerMin", max: "powerMax" },
    unit: "stats",
    section: "power",
    hasContent: () => true,
    activeCount: (s) => rangeCount(s.powerMin, s.powerMax),
    activeLabels: (s) => (rangeCount(s.powerMin, s.powerMax) ? [m.cards_filter_range_power()] : []),
  },
  {
    key: "might",
    params: { min: "mightMin", max: "mightMax" },
    unit: "stats",
    section: "might",
    hasContent: () => true,
    activeCount: (s) => rangeCount(s.mightMin, s.mightMax),
    activeLabels: (s) => (rangeCount(s.mightMin, s.mightMax) ? [m.cards_filter_range_might()] : []),
  },
  {
    key: "markers",
    params: { include: "markers", exclude: "markersEx" },
    presenceDimension: "markers",
    unit: "markers",
    section: "markers",
    hasContent: ({ availableFilters }) => availableFilters.markers.length > 0,
    activeCount: (s) => s.markers.length + s.markersEx.length,
    activeLabels: (s, l) => valueLabels(s.markers, s.markersEx, l.marker),
  },
  {
    key: "cardSizes",
    params: { include: "cardSizes" },
    unit: "cardSizes",
    section: "cardSizes",
    hasContent: ({ availableFilters }) => availableFilters.cardSizes.length > 1,
    activeCount: (s) => s.cardSizes.length,
    activeLabels: (s) => flagLabels(oversizeState(s.cardSizes), m.cards_filter_flag_oversized()),
  },
  {
    key: "channels",
    params: { include: "channels", exclude: "channelsEx", presence: "channelsPresence" },
    presenceDimension: "distributionChannels",
    unit: "channels",
    section: "channels",
    hasContent: ({ availableFilters }) => availableFilters.distributionChannels.length > 0,
    activeCount: (s) => s.channels.length + s.channelsEx.length + setCount(s.channelsPresence),
    activeLabels: (s, l) => [
      ...valueLabels(s.channels, s.channelsEx, l.channel),
      ...presenceLabels("distributionChannels", s.channelsPresence),
    ],
  },
  {
    key: "customTags",
    params: { include: "customTags", exclude: "customTagsEx", presence: "customTagsPresence" },
    presenceDimension: "customTags",
    unit: "customTags",
    section: "customTags",
    hasContent: ({ customTagCategoryCount }) => customTagCategoryCount > 0,
    activeCount: (s) =>
      s.customTags.length + s.customTagsEx.length + setCount(s.customTagsPresence),
    activeLabels: (s, l) => [
      ...valueLabels(s.customTags, s.customTagsEx, l.customTag),
      ...presenceLabels("customTags", s.customTagsPresence),
    ],
  },
  {
    key: "tags",
    params: { include: "tags", exclude: "tagsEx", presence: "tagsPresence" },
    presenceDimension: "tags",
    unit: "tags",
    section: "tags",
    hasContent: ({ availableFilters }) => availableFilters.tags.length > 0,
    activeCount: (s) => s.tags.length + s.tagsEx.length + setCount(s.tagsPresence),
    activeLabels: (s) => [
      ...valueLabels(s.tags, s.tagsEx, (tag) => tag),
      ...presenceLabels("tags", s.tagsPresence),
    ],
  },
  {
    key: "keywords",
    params: { include: "keywords", exclude: "keywordsEx", presence: "keywordsPresence" },
    presenceDimension: "keywords",
    unit: "keywords",
    section: "keywords",
    hasContent: ({ availableFilters }) => availableFilters.keywords.length > 0,
    activeCount: (s) => s.keywords.length + s.keywordsEx.length + setCount(s.keywordsPresence),
    activeLabels: (s) => [
      ...valueLabels(s.keywords, s.keywordsEx, (keyword) => keyword),
      ...presenceLabels("keywords", s.keywordsPresence),
    ],
  },
  {
    key: "banned",
    params: { flag: "banned" },
    unit: "banned",
    section: "banned",
    hasContent: ({ availableFilters }) => availableFilters.hasBanned,
    activeCount: (s) => setCount(s.banned),
    activeLabels: (s) => flagLabels(s.banned, m.cards_filter_flag_banned()),
  },
  {
    key: "errata",
    params: { flag: "errata" },
    unit: "errata",
    section: "errata",
    hasContent: ({ availableFilters }) => availableFilters.hasErrata,
    activeCount: (s) => setCount(s.errata),
    activeLabels: (s) => flagLabels(s.errata, m.cards_filter_flag_errata()),
  },
  {
    key: "noImage",
    params: { flag: "noImage" },
    unit: "noImage",
    section: "noImage",
    hasContent: ({ availableFilters }) => availableFilters.hasNoImage,
    activeCount: (s) => setCount(s.noImage),
    activeLabels: (s) => flagLabels(s.noImage, m.cards_filter_flag_no_image()),
  },
  {
    key: "owned",
    params: { include: "owned" },
    unit: "owned",
    section: "owned",
    hasContent: () => true,
    activeCount: (s) => s.owned.length,
    activeLabels: (s, l) => s.owned.map((value) => l.ownedBucket(value)),
  },
  {
    key: "copies",
    params: { min: "ownedCountMin", max: "ownedCountMax" },
    unit: "owned",
    section: "owned",
    hasContent: ({ ownedCountMax }) => ownedCountMax !== undefined && ownedCountMax > 0,
    activeCount: (s) => rangeCount(s.ownedCountMin, s.ownedCountMax),
    activeLabels: (s) =>
      rangeCount(s.ownedCountMin, s.ownedCountMax) ? [m.cards_filter_range_copies()] : [],
  },
  {
    key: "price",
    params: { min: "priceMin", max: "priceMax" },
    unit: "price",
    section: "price",
    hasContent: ({ availableFilters }) => availableFilters.price.max > 0,
    activeCount: (s) => rangeCount(s.priceMin, s.priceMax),
    activeLabels: (s) => (rangeCount(s.priceMin, s.priceMax) ? [m.cards_filter_range_price()] : []),
  },
];

const BY_KEY = new Map(FILTER_DIMENSIONS.map((dimension) => [dimension.key, dimension]));

export function dimensionParams(dimension: FilterDimension): FilterParam[] {
  const { include, exclude, presence, flag, min, max } = dimension.params;
  return [include, exclude, presence, flag, min, max].filter((param) => param !== undefined);
}

export const KEPT_FILTER_PARAMS: readonly FilterParam[] = FILTER_DIMENSIONS.filter(
  (dimension) => dimension.keptOnClear,
).flatMap((dimension) => dimensionParams(dimension));

export const CLEARABLE_FILTER_PARAMS: readonly FilterParam[] = [
  "q",
  ...FILTER_DIMENSIONS.filter((dimension) => !dimension.keptOnClear).flatMap((dimension) =>
    dimensionParams(dimension),
  ),
];

function paramIsActive(value: unknown): boolean {
  if (value === undefined || value === null || value === "") {
    return false;
  }
  return !Array.isArray(value) || value.length > 0;
}

export function hasActiveParam(search: FilterSearch, params: readonly FilterParam[]): boolean {
  return params.some((param) => paramIsActive(search[param]));
}

function presenceMaps() {
  const presenceParams: Partial<Record<PresenceDimension, PresenceFilterParam>> = {};
  const valueParams: Partial<
    Record<PresenceDimension, { include?: ArrayFilterParam; exclude?: ArrayFilterParam }>
  > = {};
  for (const dimension of FILTER_DIMENSIONS) {
    const target = dimension.presenceDimension;
    if (target === undefined) {
      continue;
    }
    const { include, exclude, presence } = dimension.params;
    if (presence) {
      presenceParams[target] = presence;
    }
    if (include || exclude) {
      valueParams[target] = { include, exclude };
    }
  }
  const arrayParamPresence: Partial<Record<ArrayFilterParam, PresenceFilterParam>> = {};
  for (const [target, { include }] of Object.entries(valueParams) as [
    PresenceDimension,
    { include?: ArrayFilterParam },
  ][]) {
    const presence = presenceParams[target];
    if (include && presence) {
      arrayParamPresence[include] = presence;
    }
  }
  return {
    presenceParams: presenceParams as Record<PresenceDimension, PresenceFilterParam>,
    valueParams: valueParams as Record<
      PresenceDimension,
      { include?: ArrayFilterParam; exclude?: ArrayFilterParam }
    >,
    arrayParamPresence,
  };
}

const PRESENCE_MAPS = presenceMaps();

export const PRESENCE_PARAMS = PRESENCE_MAPS.presenceParams;

export const PRESENCE_VALUE_PARAMS = PRESENCE_MAPS.valueParams;

export const ARRAY_PARAM_PRESENCE = PRESENCE_MAPS.arrayParamPresence;

export type ChipValueLabel =
  | "set"
  | "rarity"
  | "type"
  | "superType"
  | "domain"
  | "artVariant"
  | "finish"
  | "cardSize"
  | "marker"
  | "channel"
  | "ownedBucket"
  | "raw";

export type ActiveFilterChip =
  | {
      kind: "values";
      param: ArrayFilterParam;
      excluded: boolean;
      hiddenBy: string;
      label: () => string;
      valueLabel: ChipValueLabel;
      icon?: FilterCategory;
    }
  | { kind: "customTags"; param: "customTags" | "customTagsEx"; excluded: boolean }
  | { kind: "tags"; param: "tags" | "tagsEx"; excluded: boolean }
  | { kind: "range"; range: RangeKey; label: () => string }
  | { kind: "copies" }
  | { kind: "flag"; param: FlagFilterParam; label: () => string }
  | { kind: "presence"; dimension: PresenceDimension; label: () => string };

function valueChip(
  param: ArrayFilterParam,
  excluded: boolean,
  hiddenBy: string,
  label: () => string,
  valueLabel: ChipValueLabel,
  icon?: FilterCategory,
): ActiveFilterChip {
  return { kind: "values", param, excluded, hiddenBy, label, valueLabel, icon };
}

export const ACTIVE_FILTER_CHIPS: readonly ActiveFilterChip[] = [
  valueChip("sets", false, "sets", () => m.cards_filter_unit_sets(), "set", "sets"),
  valueChip(
    "rarities",
    false,
    "rarities",
    () => m.cards_filter_unit_rarities(),
    "rarity",
    "rarities",
  ),
  valueChip("types", false, "types", () => m.cards_filter_unit_types(), "type", "types"),
  valueChip(
    "superTypes",
    false,
    "superTypes",
    () => m.cards_filter_unit_super_types(),
    "superType",
    "superTypes",
  ),
  valueChip("domains", false, "domains", () => m.cards_filter_unit_domains(), "domain", "domains"),
  valueChip(
    "artVariants",
    false,
    "artVariants",
    () => m.cards_filter_label_art_variant(),
    "artVariant",
    "artVariants",
  ),
  valueChip(
    "finishes",
    false,
    "finishes",
    () => m.cards_filter_label_finish(),
    "finish",
    "finishes",
  ),
  valueChip(
    "cardSizes",
    false,
    "cardSizes",
    () => m.cards_filter_unit_card_sizes(),
    "cardSize",
    "cardSizes",
  ),
  valueChip("markers", false, "markers", () => m.cards_filter_label_marker(), "marker"),
  valueChip("channels", false, "channels", () => m.cards_filter_label_channel(), "channel"),
  valueChip("keywords", false, "keywords", () => m.cards_filter_label_keyword(), "raw"),
  valueChip("owned", false, "owned", () => m.cards_filter_unit_owned(), "ownedBucket"),
  { kind: "customTags", param: "customTags", excluded: false },
  { kind: "tags", param: "tags", excluded: false },
  valueChip("setsEx", true, "sets", () => m.cards_filter_unit_sets(), "set", "sets"),
  valueChip(
    "raritiesEx",
    true,
    "rarities",
    () => m.cards_filter_unit_rarities(),
    "rarity",
    "rarities",
  ),
  valueChip("typesEx", true, "types", () => m.cards_filter_unit_types(), "type", "types"),
  valueChip(
    "superTypesEx",
    true,
    "superTypes",
    () => m.cards_filter_unit_super_types(),
    "superType",
    "superTypes",
  ),
  valueChip("domainsEx", true, "domains", () => m.cards_filter_unit_domains(), "domain", "domains"),
  valueChip(
    "artVariantsEx",
    true,
    "artVariants",
    () => m.cards_filter_label_art_variant(),
    "artVariant",
    "artVariants",
  ),
  valueChip(
    "finishesEx",
    true,
    "finishes",
    () => m.cards_filter_label_finish(),
    "finish",
    "finishes",
  ),
  valueChip("markersEx", true, "markers", () => m.cards_filter_label_marker(), "marker"),
  valueChip("channelsEx", true, "channels", () => m.cards_filter_label_channel(), "channel"),
  valueChip("keywordsEx", true, "keywords", () => m.cards_filter_label_keyword(), "raw"),
  { kind: "customTags", param: "customTagsEx", excluded: true },
  { kind: "tags", param: "tagsEx", excluded: true },
  { kind: "range", range: "energy", label: () => m.cards_filter_range_energy() },
  { kind: "range", range: "might", label: () => m.cards_filter_range_might() },
  { kind: "range", range: "power", label: () => m.cards_filter_range_power() },
  { kind: "range", range: "price", label: () => m.cards_filter_range_price() },
  { kind: "copies" },
  { kind: "flag", param: "overnumbered", label: () => m.cards_filter_flag_overnumbered() },
  { kind: "flag", param: "signed", label: () => m.cards_filter_flag_signed() },
  { kind: "presence", dimension: "markers", label: () => m.cards_filter_flag_promo() },
  { kind: "presence", dimension: "superTypes", label: () => presenceLabel("superTypes") },
  { kind: "presence", dimension: "customTags", label: () => presenceLabel("customTags") },
  {
    kind: "presence",
    dimension: "distributionChannels",
    label: () => presenceLabel("distributionChannels"),
  },
  { kind: "presence", dimension: "keywords", label: () => presenceLabel("keywords") },
  { kind: "presence", dimension: "tags", label: () => presenceLabel("tags") },
  { kind: "flag", param: "banned", label: () => m.cards_filter_flag_banned() },
  { kind: "flag", param: "errata", label: () => m.cards_filter_flag_errata() },
  { kind: "flag", param: "noImage", label: () => m.cards_filter_flag_no_image() },
  { kind: "flag", param: "standard", label: () => m.cards_filter_flag_standard() },
];

export function filterDimension(key: string): FilterDimension {
  const dimension = BY_KEY.get(key);
  if (!dimension) {
    throw new Error(`Unknown filter dimension: ${key}`);
  }
  return dimension;
}

export function visibleFilterDimensions(
  input: FilterDimensionAvailability,
  hiddenSections?: ReadonlySet<string>,
): ReadonlySet<string> {
  const visible = new Set<string>();
  for (const dimension of FILTER_DIMENSIONS) {
    if (!hiddenSections?.has(dimension.section) && dimension.hasContent(input)) {
      visible.add(dimension.key);
    }
  }
  return visible;
}

export function sectionHasContent(section: string, input: FilterDimensionAvailability): boolean {
  return FILTER_DIMENSIONS.some(
    (dimension) => dimension.section === section && dimension.hasContent(input),
  );
}

export function countActiveFilterDimensions(
  state: FilterDimensionState,
  inScope: (unit: string) => boolean,
): number {
  let total = 0;
  for (const dimension of FILTER_DIMENSIONS) {
    if (inScope(dimension.unit)) {
      total += dimension.activeCount(state);
    }
  }
  return total;
}

export function activeFilterDimensionLabels(
  state: FilterDimensionState,
  labels: FilterDimensionLabels,
  inScope: (unit: string) => boolean,
): string[] {
  const entries: string[] = [];
  for (const dimension of FILTER_DIMENSIONS) {
    if (inScope(dimension.unit)) {
      entries.push(...dimension.activeLabels(state, labels));
    }
  }
  return entries;
}
