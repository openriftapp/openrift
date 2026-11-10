// `z.coerce.number()` accepts 1e30, which postgres.js sends in exponent form and
// Postgres rejects. Every paged input is bounded before it reaches a query.
export const MAX_OFFSET = 1_000_000;

export const MAX_FACET_VALUES = 300;

// The event payload carries this many rows, and the web seeds its cache under a
// key built from it, so a change here silently mismatches that key on both sides.
export const STANDINGS_PAGE_SIZE = 200;

export const META_PAGE_SIZES = [50, 100, 200, 500] as const;

/** The largest page a list serves, which is the largest size its picker offers. */
export const META_MAX_LIST_PAGE_SIZE = Math.max(...META_PAGE_SIZES);

/** The whole field of the largest event the archive holds, for a reader who asked for all of it. */
export const META_MAX_PAGE_SIZE = 5000;

export const META_EVENT_HOLDINGS = ["decks", "standings", "upcoming", "resultless"] as const;

export const META_EVENT_INDEX_SORTS = [
  "date",
  "name",
  "tier",
  "country",
  "players",
  "decks",
] as const;
