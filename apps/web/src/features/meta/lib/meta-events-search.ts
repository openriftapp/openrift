/* oxlint-disable unicorn/no-useless-undefined, promise/prefer-await-to-then, unicorn/prefer-top-level-await -- zod's `.catch(undefined)` is a sync fallback, not a Promise#catch */
import { META_EVENT_HOLDINGS, META_EVENT_INDEX_SORTS } from "@openrift/shared/contracts/meta";
import { z } from "zod";

import { metaPageSlice, metaPagingSearchFields } from "@/features/meta/lib/meta-paging";
import { metaScopeSearchSchema } from "@/features/meta/lib/meta-scope";

// Schema only, no logic: a route's non-lazy `*.tsx` runs on every page load, so
// anything this module pulls in lands in the startup bundle of every route.
// `meta-events-index` reaches `lib/country`, which builds an `Intl.DisplayNames`
// at module scope.

export { META_EVENT_HOLDINGS } from "@openrift/shared/contracts/meta";

export type MetaEventIndexSort = (typeof META_EVENT_INDEX_SORTS)[number];

export type MetaEventIndexSortDirection = "asc" | "desc";

export type MetaEventHoldings = (typeof META_EVENT_HOLDINGS)[number];

const DEFAULT_EVENT_SORT: MetaEventIndexSort = "date";
const DEFAULT_EVENT_DIRECTION: MetaEventIndexSortDirection = "desc";

export const DEFAULT_EVENT_PAGE_SIZE = 50;

/**
 * Every field `.catch`es to undefined, so a stale bookmark drops the bad value and the route doesn't crash.
 * Named `by`, not `sort`: the router unions every route's search schema, and a `sort` key here would break other routes' search reducers.
 */
export const metaEventsSearchSchema = metaScopeSearchSchema.extend({
  q: z.string().max(200).optional().catch(undefined),
  holds: z.enum(META_EVENT_HOLDINGS).optional().catch(undefined),
  playersMin: z.number().int().nonnegative().optional().catch(undefined),
  playersMax: z.number().int().nonnegative().optional().catch(undefined),
  by: z.enum(META_EVENT_INDEX_SORTS).optional().catch(undefined),
  dir: z.enum(["asc", "desc"]).optional().catch(undefined),
  ...metaPagingSearchFields(),
});

export type MetaEventsSearch = z.infer<typeof metaEventsSearchSchema>;

/** The page of the index a link names, as the API takes it. */
export function eventPageSlice(search: MetaEventsSearch): { limit: number; offset: number } {
  return metaPageSlice(search.page, search.per ?? DEFAULT_EVENT_PAGE_SIZE);
}

/** The order a link names, resolved, so the loader and the page ask for one key. */
export function eventPageOrder(search: Pick<MetaEventsSearch, "by" | "dir">): {
  by: MetaEventIndexSort;
  dir: MetaEventIndexSortDirection;
} {
  return { by: search.by ?? DEFAULT_EVENT_SORT, dir: search.dir ?? DEFAULT_EVENT_DIRECTION };
}
