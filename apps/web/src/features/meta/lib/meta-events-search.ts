import { META_EVENT_HOLDINGS, META_EVENT_INDEX_SORTS } from "@openrift/shared/meta-query";
import { z } from "zod/mini";

import { metaPageSlice, metaPagingSearchFields } from "@/features/meta/lib/meta-paging";
import { metaScopeSearchSchema } from "@/features/meta/lib/meta-scope";
import { lenient } from "@/lib/lenient-param";

// Schema only, no logic: a route's non-lazy `*.tsx` runs on every page load, so
// anything this module pulls in lands in the startup bundle of every route.
// `meta-events-index` reaches `lib/country`, which builds an `Intl.DisplayNames`
// at module scope.

export type MetaEventIndexSort = (typeof META_EVENT_INDEX_SORTS)[number];

export type MetaEventIndexSortDirection = "asc" | "desc";

export type MetaEventHoldings = (typeof META_EVENT_HOLDINGS)[number];

/** `all` lifts the index's default of events with results; the API takes no `holds` for it. */
const META_EVENT_INDEX_HOLDINGS = [...META_EVENT_HOLDINGS, "all"] as const;

export type MetaEventIndexHoldings = (typeof META_EVENT_INDEX_HOLDINGS)[number];

const DEFAULT_EVENT_SORT: MetaEventIndexSort = "date";
const DEFAULT_EVENT_DIRECTION: MetaEventIndexSortDirection = "desc";

export const DEFAULT_EVENT_PAGE_SIZE = 50;

/**
 * Every field is `lenient`, so a stale bookmark drops the bad value and the route doesn't crash.
 * Named `by`, not `sort`: the router unions every route's search schema, and a `sort` key here would break other routes' search reducers.
 */
export const metaEventsSearchSchema = z.extend(metaScopeSearchSchema, {
  q: lenient(z.string().check(z.maxLength(200))),
  holds: lenient(z.enum(META_EVENT_INDEX_HOLDINGS)),
  playersMin: lenient(z.number().check(z.int(), z.nonnegative())),
  playersMax: lenient(z.number().check(z.int(), z.nonnegative())),
  by: lenient(z.enum(META_EVENT_INDEX_SORTS)),
  dir: lenient(z.enum(["asc", "desc"])),
  ...metaPagingSearchFields(),
});

export type MetaEventsSearch = z.infer<typeof metaEventsSearchSchema>;

/** The page of the index a link names, as the API takes it. */
export function eventPageSlice(search: MetaEventsSearch): { limit: number; offset: number } {
  return metaPageSlice(search.page, search.per ?? DEFAULT_EVENT_PAGE_SIZE);
}

export function eventIndexHoldings(holds?: MetaEventIndexHoldings): MetaEventHoldings | undefined {
  if (holds === undefined) {
    return "standings";
  }
  return holds === "all" ? undefined : holds;
}

/** The order a link names, resolved, so the loader and the page ask for one key. */
export function eventPageOrder(search: Pick<MetaEventsSearch, "by" | "dir">): {
  by: MetaEventIndexSort;
  dir: MetaEventIndexSortDirection;
} {
  return { by: search.by ?? DEFAULT_EVENT_SORT, dir: search.dir ?? DEFAULT_EVENT_DIRECTION };
}
