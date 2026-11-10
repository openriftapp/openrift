import { MAX_FACET_VALUES } from "@openrift/shared/meta-query";
import { z } from "zod/mini";

import { metaPagingSearchFields } from "@/features/meta/lib/meta-paging";
import { metaScopeSearchSchema } from "@/features/meta/lib/meta-scope";
import { lenient } from "@/lib/lenient-param";

const META_DECK_SORTS = ["date", "finish", "value", "cost"] as const;

export type MetaDeckSort = (typeof META_DECK_SORTS)[number];

export type MetaDeckSortDirection = "asc" | "desc";

export const DEFAULT_DECK_SORT: MetaDeckSort = "date";
export const DEFAULT_DECK_DIRECTION: MetaDeckSortDirection = "desc";

export const metaDeckSearchSchema = z.extend(metaScopeSearchSchema, {
  by: lenient(z.enum(META_DECK_SORTS)),
  dir: lenient(z.enum(["asc", "desc"])),
  events: lenient(z.array(z.string().check(z.minLength(1))).check(z.maxLength(MAX_FACET_VALUES))),
  legends: lenient(z.array(z.uuid()).check(z.maxLength(MAX_FACET_VALUES))),
  /** Rank bound: 1, 4, 8, or 16. */
  finish: lenient(z.number().check(z.int(), z.positive())),
  /** Absent means the curated view: one tile per legend per event. */
  all: lenient(z.boolean()),
  /** Currency major units. */
  cost: lenient(z.number().check(z.nonnegative())),
  side: lenient(z.boolean()),
  /** Currency major units. */
  valueMin: lenient(z.number().check(z.nonnegative())),
  valueMax: lenient(z.number().check(z.nonnegative())),
  ...metaPagingSearchFields(),
});

export const DEFAULT_DECK_PAGE_SIZE = 50;

/** Value and cost are priced in the browser, so they order the page on screen and nothing else. */
export function isBrowserDeckSort(sort: MetaDeckSort): sort is "value" | "cost" {
  return sort === "value" || sort === "cost";
}

/** The order the API is asked for: a browser-side sort takes the newest page to reorder. */
export function serverDeckOrder(
  sort: MetaDeckSort,
  direction: MetaDeckSortDirection,
): { by: "date" | "finish"; dir: MetaDeckSortDirection } {
  return isBrowserDeckSort(sort) ? { by: "date", dir: "desc" } : { by: sort, dir: direction };
}

export type MetaDeckSearch = z.infer<typeof metaDeckSearchSchema>;

/** `/meta` routes `q` through `metaEventFilterQuery`, so the event filter's bound applies. */
export const metaOverviewSearchSchema = z.extend(metaScopeSearchSchema, {
  q: lenient(z.string().check(z.maxLength(200))),
  decks: lenient(z.boolean()),
});
