import { z } from "zod/mini";

export type SearchField =
  | "name"
  | "cardText"
  | "keywords"
  | "tags"
  | "artist"
  | "flavorText"
  | "type"
  | "id";

export const ALL_SEARCH_FIELDS: SearchField[] = [
  "name",
  "cardText",
  "keywords",
  "tags",
  "artist",
  "flavorText",
  "type",
  "id",
];

export const GROUP_BY_FIELDS = [
  "none",
  "set",
  "type",
  "superType",
  "domain",
  "rarity",
  "card",
  "channel",
  "year",
  "marker",
  "collection",
] as const;

export type GroupByField = (typeof GROUP_BY_FIELDS)[number];

export const SORT_OPTIONS = ["id", "name", "energy", "rarity", "price"] as const;

export type SortOption = (typeof SORT_OPTIONS)[number];

export function isSortOption(value: string): value is SortOption {
  return (SORT_OPTIONS as readonly string[]).includes(value);
}

export const SORT_DIRECTIONS = ["asc", "desc"] as const;

export type SortDirection = (typeof SORT_DIRECTIONS)[number];

/** As `min`, includes null-stat cards; as `max`, matches only null-stat cards. */
export const NONE = -1;

export interface FilterRange {
  min: number | null;
  max: number | null;
}

export type RangeKey = "energy" | "might" | "power" | "price";

export const PRESENCE_DIMENSIONS = [
  "markers",
  "superTypes",
  "customTags",
  "distributionChannels",
  "keywords",
  "tags",
] as const;

export type PresenceDimension = (typeof PRESENCE_DIMENSIONS)[number];

export type PresenceState = "any" | "none";

// Every dimension needs a default, so an absent key backfills.
// `cardFiltersSchema.parse({})` must equal EMPTY_CARD_FILTERS.
const filterRangeSchema = z._default(
  z.object({
    min: z.nullable(z.number()),
    max: z.nullable(z.number()),
  }),
  () => ({ min: null, max: null }),
);

const stringArray = () => z._default(z.array(z.string()), () => []);

const nullableFlag = () => z._default(z.nullable(z.boolean()), null);

export const cardFiltersSchema = z.object({
  search: z._default(z.string(), ""),
  sets: stringArray(),
  languages: stringArray(),
  rarities: stringArray(),
  types: stringArray(),
  superTypes: stringArray(),
  domains: stringArray(),
  energy: filterRangeSchema,
  might: filterRangeSchema,
  power: filterRangeSchema,
  price: filterRangeSchema,
  artVariants: stringArray(),
  finishes: stringArray(),
  cardSizes: stringArray(),
  isSigned: nullableFlag(),
  isOvernumbered: nullableFlag(),
  presence: z._default(
    z.partialRecord(z.enum(PRESENCE_DIMENSIONS), z.enum(["any", "none"])),
    () => ({}),
  ),
  markerSlugs: stringArray(),
  distributionChannelSlugs: stringArray(),
  customTagSlugs: stringArray(),
  keywords: stringArray(),
  tags: stringArray(),
  isBanned: nullableFlag(),
  hasErrata: nullableFlag(),
  hasNoImage: nullableFlag(),
  setsExclude: stringArray(),
  languagesExclude: stringArray(),
  raritiesExclude: stringArray(),
  typesExclude: stringArray(),
  superTypesExclude: stringArray(),
  domainsExclude: stringArray(),
  artVariantsExclude: stringArray(),
  finishesExclude: stringArray(),
  markerSlugsExclude: stringArray(),
  distributionChannelSlugsExclude: stringArray(),
  customTagSlugsExclude: stringArray(),
  keywordsExclude: stringArray(),
  tagsExclude: stringArray(),
  isStandard: nullableFlag(),
});

export type CardFilters = z.infer<typeof cardFiltersSchema>;

// Spread and override this to build a fresh CardFilters, so a new dimension
// never gets forgotten at a call site.
export const EMPTY_CARD_FILTERS: CardFilters = {
  search: "",
  sets: [],
  languages: [],
  rarities: [],
  types: [],
  superTypes: [],
  domains: [],
  energy: { min: null, max: null },
  might: { min: null, max: null },
  power: { min: null, max: null },
  price: { min: null, max: null },
  artVariants: [],
  finishes: [],
  cardSizes: [],
  isSigned: null,
  isOvernumbered: null,
  presence: {},
  markerSlugs: [],
  distributionChannelSlugs: [],
  customTagSlugs: [],
  keywords: [],
  tags: [],
  isBanned: null,
  hasErrata: null,
  hasNoImage: null,
  setsExclude: [],
  languagesExclude: [],
  raritiesExclude: [],
  typesExclude: [],
  superTypesExclude: [],
  domainsExclude: [],
  artVariantsExclude: [],
  finishesExclude: [],
  markerSlugsExclude: [],
  distributionChannelSlugsExclude: [],
  customTagSlugsExclude: [],
  keywordsExclude: [],
  tagsExclude: [],
  isStandard: null,
};
