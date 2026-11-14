import { z } from "zod/mini";

import { metaScopeSearchSchema } from "@/features/meta/lib/meta-scope";
import { lenient } from "@/lib/lenient-param";

// Schema only: non-lazy route files import this on every page load, and
// `meta-legend-page` reaches `lib/country`, whose top-level await delays startup.

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
