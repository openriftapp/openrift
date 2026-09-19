/* oxlint-disable unicorn/no-useless-undefined, promise/prefer-await-to-then, unicorn/prefer-top-level-await -- zod's `.catch(undefined)` is a sync fallback, not a Promise#catch */
import { MAX_OFFSET, META_MAX_PAGE_SIZE, META_PAGE_SIZES } from "@openrift/shared/contracts/meta";
import { z } from "zod";

// Schema and page arithmetic only, no logic: a route's non-lazy `*.tsx` runs
// on every page load, so anything this module pulls in lands in the startup
// bundle of every route.

export { META_MAX_PAGE_SIZE, META_PAGE_SIZES } from "@openrift/shared/contracts/meta";

export const META_PAGE_ALL = "all";

export type MetaPageSizeValue = (typeof META_PAGE_SIZES)[number];

/** A size a link may carry: one of the offered pages, or the whole list. */
export type MetaPageSize = MetaPageSizeValue | typeof META_PAGE_ALL;

// `z.coerce.number()` accepts 1e30, which no offset arithmetic survives.
const pageField = z.coerce.number().int().positive().max(MAX_OFFSET).optional().catch(undefined);

// Only the sizes the pickers offer: any other number leaves the picker's
// trigger with no item to show.
const offeredSize = z.coerce.number().pipe(z.literal(META_PAGE_SIZES));

/** A page and a size a link may carry, for a list whose pages stop at a size. */
export function metaPagingSearchFields() {
  return { page: pageField, per: offeredSize.optional().catch(undefined) };
}

/** The same, for a list a reader may ask to see whole. */
export function metaPagingSearchFieldsWithAll() {
  return {
    page: pageField,
    per: z
      .union([z.literal(META_PAGE_ALL), offeredSize])
      .optional()
      .catch(undefined),
  };
}

/** How many rows one page holds, capped for the reader who asked for all of them. */
export function metaPageSize(
  per: MetaPageSize | undefined,
  fallback: number,
  total: number,
): number {
  if (per === META_PAGE_ALL) {
    return Math.max(1, Math.min(total, META_MAX_PAGE_SIZE));
  }
  return per ?? fallback;
}

/** The slice of a list the API is asked for, its offset inside what the contract accepts. */
export function metaPageSlice(
  page: number | undefined,
  limit: number,
): { limit: number; offset: number } {
  return { limit, offset: Math.min(((page ?? 1) - 1) * limit, MAX_OFFSET) };
}

export function metaPageCount(total: number, perPage: number): number {
  return Math.max(1, Math.ceil(total / perPage));
}
