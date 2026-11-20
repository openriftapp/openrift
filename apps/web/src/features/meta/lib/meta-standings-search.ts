import { NO_LEGEND, STANDINGS_PAGE_SIZE } from "@openrift/shared/meta-query";
import { z } from "zod/mini";

import {
  META_PAGE_ALL,
  metaPageSize,
  metaPageSlice,
  metaPagingSearchFieldsWithAll,
} from "@/features/meta/lib/meta-paging";
import { lenient } from "@/lib/lenient-param";

// Schema and page arithmetic only: the event route's non-lazy `*.tsx` runs on
// every page load.

/**
 * Every field is `lenient`, so a stale link drops the bad value and
 * the route still renders. Each bound is the contract's own: a value the API
 * would reject has to be dropped here, or the awaited loader fails the page.
 */
export const metaStandingsSearchSchema = z.object({
  q: lenient(z.string().check(z.maxLength(200))),
  list: lenient(z.literal("with")),
  legend: lenient(z.union([z.uuid(), z.literal(NO_LEGEND)])),
  by: lenient(z.literal("legend")),
  ...metaPagingSearchFieldsWithAll(),
});

export type MetaStandingsSearch = z.infer<typeof metaStandingsSearchSchema>;

/** How many entries one page of the standings holds. */
export function standingsPageSize(search: MetaStandingsSearch, total: number): number {
  return metaPageSize(search.per, STANDINGS_PAGE_SIZE, total);
}

export function offersLegendFilter(total: number, legendCount: number): boolean {
  return total > 8 && legendCount > 1;
}

export function groupsByLegend(
  search: MetaStandingsSearch,
  total: number,
  legendCount: number,
): boolean {
  return search.by === "legend" && offersLegendFilter(total, legendCount);
}

/** The page the API is asked for, narrowings included. */
export function standingsPageQuery(
  search: MetaStandingsSearch,
  total: number,
  grouped = false,
): { q?: string; list?: "with"; legend?: string; limit: number; offset: number } {
  const needle = search.q?.trim() ?? "";
  return {
    q: needle === "" ? undefined : needle,
    list: search.list,
    legend: search.legend,
    ...(grouped
      ? metaPageSlice(undefined, metaPageSize(META_PAGE_ALL, STANDINGS_PAGE_SIZE, total))
      : metaPageSlice(search.page, standingsPageSize(search, total))),
  };
}
