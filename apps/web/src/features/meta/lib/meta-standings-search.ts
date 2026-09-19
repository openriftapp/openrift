/* oxlint-disable unicorn/no-useless-undefined, promise/prefer-await-to-then, unicorn/prefer-top-level-await -- zod's `.catch(undefined)` is a sync fallback, not a Promise#catch */
import { STANDINGS_PAGE_SIZE } from "@openrift/shared/contracts/meta";
import { z } from "zod";

import {
  metaPageSize,
  metaPageSlice,
  metaPagingSearchFieldsWithAll,
} from "@/features/meta/lib/meta-paging";

// Schema and page arithmetic only: the event route's non-lazy `*.tsx` runs on
// every page load.

/**
 * Every field `.catch`es to undefined, so a stale link drops the bad value and
 * the route still renders. Each bound is the contract's own: a value the API
 * would reject has to be dropped here, or the awaited loader fails the page.
 */
export const metaStandingsSearchSchema = z.object({
  q: z.string().max(200).optional().catch(undefined),
  list: z.literal("with").optional().catch(undefined),
  legend: z.uuid().optional().catch(undefined),
  ...metaPagingSearchFieldsWithAll(),
});

export type MetaStandingsSearch = z.infer<typeof metaStandingsSearchSchema>;

/** How many entries one page of the standings holds. */
export function standingsPageSize(search: MetaStandingsSearch, total: number): number {
  return metaPageSize(search.per, STANDINGS_PAGE_SIZE, total);
}

/** The page the API is asked for, narrowings included. */
export function standingsPageQuery(
  search: MetaStandingsSearch,
  total: number,
): { q?: string; list?: "with"; legend?: string; limit: number; offset: number } {
  const needle = search.q?.trim() ?? "";
  return {
    q: needle === "" ? undefined : needle,
    list: search.list,
    legend: search.legend,
    ...metaPageSlice(search.page, standingsPageSize(search, total)),
  };
}
