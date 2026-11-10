import { translateLegacyQuery } from "@openrift/shared/search-query/legacy";
import { GROUP_BY_FIELDS, SORT_DIRECTIONS, SORT_OPTIONS } from "@openrift/shared/types/search";
import { z } from "zod/mini";

import { lenient } from "@/lib/lenient-param";

const stringField = () => lenient(z.string());
const numberField = () => lenient(z.number());
const stringArray = () => lenient(z.array(z.string()));
const boolFlag = () => lenient(z.boolean());
const presenceField = () => lenient(z.enum(["any", "none"]));

const URL_GROUP_BY_VALUES = [...GROUP_BY_FIELDS, "card"] as const;
const ownedFilter = () => lenient(z.array(z.enum(["none", "partial", "full", "extra"])));

export type OwnedBucket = "none" | "partial" | "full" | "extra";

/**
 * Applied individually to /cards, /collections, /decks, and /promos routes.
 * Routes that don't expose every facet pass `hiddenSections` to the filter UI.
 */
export const filterSearchSchema = z.object({
  q: stringField(),
  sets: stringArray(),
  languages: stringArray(),
  rarities: stringArray(),
  types: stringArray(),
  superTypes: stringArray(),
  domains: stringArray(),
  artVariants: stringArray(),
  finishes: stringArray(),
  cardSizes: stringArray(),
  markers: stringArray(),
  channels: stringArray(),
  customTags: stringArray(),
  keywords: stringArray(),
  tags: stringArray(),
  setsEx: stringArray(),
  languagesEx: stringArray(),
  raritiesEx: stringArray(),
  typesEx: stringArray(),
  superTypesEx: stringArray(),
  domainsEx: stringArray(),
  artVariantsEx: stringArray(),
  finishesEx: stringArray(),
  markersEx: stringArray(),
  channelsEx: stringArray(),
  customTagsEx: stringArray(),
  keywordsEx: stringArray(),
  tagsEx: stringArray(),
  standard: boolFlag(),
  energyMin: numberField(),
  energyMax: numberField(),
  mightMin: numberField(),
  mightMax: numberField(),
  powerMin: numberField(),
  powerMax: numberField(),
  priceMin: numberField(),
  priceMax: numberField(),
  ownedCountMin: numberField(),
  ownedCountMax: numberField(),
  owned: ownedFilter(),
  signed: boolFlag(),
  overnumbered: boolFlag(),
  markersPresence: presenceField(),
  superTypesPresence: presenceField(),
  customTagsPresence: presenceField(),
  channelsPresence: presenceField(),
  keywordsPresence: presenceField(),
  tagsPresence: presenceField(),
  banned: boolFlag(),
  errata: boolFlag(),
  noImage: boolFlag(),
  sort: lenient(z.enum(SORT_OPTIONS)),
  sortDir: lenient(z.enum(SORT_DIRECTIONS)),
  view: lenient(z.enum(["cards", "printings", "copies"])),
  groupBy: lenient(z.enum(URL_GROUP_BY_VALUES)),
  groupDir: lenient(z.enum(SORT_DIRECTIONS)),
});

export type FilterSearch = z.infer<typeof filterSearchSchema>;

/**
 * `wanted` narrows a group "bulk box" to printings the viewer's wish lists
 * still want; absent (not `false`) when off, so the URL stays clean.
 */
export const collectionDetailSearchSchema = z.extend(filterSearchSchema, {
  wanted: boolFlag(),
});

/**
 * TanStack merges raw URL keys onto the validated search (Object.assign in
 * buildLocation), so re-parsing with the schema is needed to get the clean set.
 */
export function cleanedSearchForRedirect<Output extends Record<string, unknown>>(
  schema: z.core.$ZodType<Output>,
  search: unknown,
  searchStr: string,
): Output | null {
  const parsed = z.safeParse(schema, search);
  let cleaned = parsed.success ? parsed.data : ({} as Output);
  const legacy = (search as { search?: unknown }).search;
  if (
    schema instanceof z.core.$ZodObject &&
    "q" in schema._zod.def.shape &&
    !("search" in schema._zod.def.shape) &&
    (typeof legacy === "string" || typeof legacy === "number") &&
    (cleaned as { q?: string }).q === undefined
  ) {
    cleaned = { ...cleaned, q: translateLegacyQuery(String(legacy)) };
  }
  const rawKeys = new Set(new URLSearchParams(searchStr).keys());
  const cleanedKeys = new Set(
    Object.entries(cleaned)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key),
  );
  const hasExtraneous =
    rawKeys.size !== cleanedKeys.size || [...rawKeys].some((key) => !cleanedKeys.has(key));
  return hasExtraneous ? cleaned : null;
}
