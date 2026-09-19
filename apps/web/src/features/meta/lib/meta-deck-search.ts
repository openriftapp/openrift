/* oxlint-disable unicorn/no-useless-undefined, promise/prefer-await-to-then, unicorn/prefer-top-level-await -- zod's `.catch(undefined)` is a sync fallback, not a Promise#catch */
import { MAX_FACET_VALUES } from "@openrift/shared/contracts/meta";
import { z } from "zod";

import { metaPagingSearchFields } from "@/features/meta/lib/meta-paging";
import { metaScopeSearchSchema } from "@/features/meta/lib/meta-scope";

const META_DECK_SORTS = ["date", "finish", "value", "cost"] as const;

export type MetaDeckSort = (typeof META_DECK_SORTS)[number];

export type MetaDeckSortDirection = "asc" | "desc";

export const DEFAULT_DECK_SORT: MetaDeckSort = "date";
export const DEFAULT_DECK_DIRECTION: MetaDeckSortDirection = "desc";

export const metaDeckSearchSchema = metaScopeSearchSchema.extend({
  by: z.enum(META_DECK_SORTS).optional().catch(undefined),
  dir: z.enum(["asc", "desc"]).optional().catch(undefined),
  events: z.array(z.string().min(1)).max(MAX_FACET_VALUES).optional().catch(undefined),
  legends: z.array(z.uuid()).max(MAX_FACET_VALUES).optional().catch(undefined),
  /** Rank bound: 1, 4, 8, or 16. */
  finish: z.number().int().positive().optional().catch(undefined),
  /** Absent means the curated view: one tile per legend per event. */
  all: z.boolean().optional().catch(undefined),
  /** Currency major units. */
  cost: z.number().nonnegative().optional().catch(undefined),
  side: z.boolean().optional().catch(undefined),
  /** Currency major units. */
  valueMin: z.number().nonnegative().optional().catch(undefined),
  valueMax: z.number().nonnegative().optional().catch(undefined),
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
export const metaOverviewSearchSchema = metaScopeSearchSchema.extend({
  q: z.string().max(200).optional().catch(undefined),
  decks: z.boolean().optional().catch(undefined),
});
