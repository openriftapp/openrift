import { z } from "zod/mini";

import { metaScopeSearchSchema } from "@/features/meta/lib/meta-scope";
import { lenient } from "@/lib/lenient-param";

// Schema only, no logic: a route's non-lazy `*.tsx` runs on every page load, so
// anything this module pulls in lands in the startup bundle of every route.
// `meta-legend-page` reaches `lib/country`, which builds an `Intl.DisplayNames`
// at module scope.

const META_LEGEND_INDEX_SORTS = ["name", "best", "decklists", "finishes"] as const;

export type MetaLegendIndexSort = (typeof META_LEGEND_INDEX_SORTS)[number];

export type MetaLegendIndexSortDirection = "asc" | "desc";

export const DEFAULT_LEGEND_SORT: MetaLegendIndexSort = "name";
export const DEFAULT_LEGEND_DIRECTION: MetaLegendIndexSortDirection = "asc";

/** Named `by`, not `sort`: the router unions every route's search schema, and a `sort` key here breaks other routes' search reducers. */
export const metaLegendsSearchSchema = z.extend(metaScopeSearchSchema, {
  q: lenient(z.string()),
  by: lenient(z.enum(META_LEGEND_INDEX_SORTS)),
  dir: lenient(z.enum(["asc", "desc"])),
});

/** The legend page adds no params of its own; the Best/All toggle is a view of the scope, not a second address. */
export { metaScopeSearchSchema as metaLegendSearchSchema } from "@/features/meta/lib/meta-scope";
