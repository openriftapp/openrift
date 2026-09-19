import type {
  MetaCountsQuery,
  MetaEventDayCountsQuery,
  MetaEventFilterQuery,
  MetaDeckCardsQuery,
  MetaDeckQuery,
  MetaEventListQuery,
  MetaEventStandingsQuery,
  MetaScopeQuery,
} from "@openrift/shared/types/api/meta";

// An absent filter and one that narrows nothing share the unscoped key, so
// they don't cache the same fetch twice.
function metaFilterKey<T extends object>(
  base: readonly string[],
  filter: T | undefined,
  fields: readonly (keyof T)[],
): readonly unknown[] {
  if (filter === undefined || fields.every((field) => filter[field] === undefined)) {
    return base;
  }
  return [...base, Object.fromEntries(fields.map((field) => [field, filter[field] ?? null]))];
}

const SCOPE_FIELDS = [
  "from",
  "to",
  "formats",
  "formatsEx",
  "tiers",
  "tiersEx",
  "countries",
  "countriesEx",
] as const;

const DECK_FACET_FIELDS = [
  ...SCOPE_FIELDS,
  "legend",
  "player",
  "events",
  "legends",
  "maxRank",
  "curated",
] as const;

const DECK_QUERY_FIELDS = [...DECK_FACET_FIELDS, "by", "dir", "limit", "offset"] as const;

const DECK_CARDS_FIELDS = [...DECK_QUERY_FIELDS, "event"] as const;

const COUNTS_QUERY_FIELDS = ["format", "dateFrom", "dateTo"] as const;

const EVENT_FILTER_FIELDS = [
  ...SCOPE_FIELDS,
  "slug",
  "q",
  "holds",
  "playersMin",
  "playersMax",
] as const;

const EVENT_LIST_FIELDS = [...EVENT_FILTER_FIELDS, "by", "dir", "limit", "offset"] as const;

const DAY_COUNTS_FIELDS = [
  "formats",
  "formatsEx",
  "tiers",
  "tiersEx",
  "countries",
  "countriesEx",
  "q",
  "holds",
  "playersMin",
  "playersMax",
] as const;

const STANDINGS_FIELDS = ["q", "list", "legend", "limit", "offset"] as const;

const LEGEND_QUERY_FIELDS = [...SCOPE_FIELDS, "page"] as const;

// Admin mutations invalidate the `all` prefix: every public read
// denormalizes event fields, so any write can stale any of them.
export const metaKeys = {
  all: ["meta"] as const,
  // A base of its own: `event` keys a slug under ["meta", "events"].
  eventPage: (query?: MetaEventListQuery) =>
    metaFilterKey(["meta", "event-page"], query, EVENT_LIST_FIELDS),
  eventFacets: (query?: MetaEventFilterQuery) =>
    metaFilterKey(["meta", "event-facets"], query, EVENT_FILTER_FIELDS),
  activity: ["meta", "activity"] as const,
  counts: (query?: MetaCountsQuery) =>
    metaFilterKey(["meta", "counts"], query, COUNTS_QUERY_FIELDS),
  eventDayCounts: (query?: MetaEventDayCountsQuery) =>
    metaFilterKey(["meta", "events", "day-counts"], query, DAY_COUNTS_FIELDS),
  event: (slug: string) => ["meta", "events", slug] as const,
  standings: (slug: string, query?: Omit<MetaEventStandingsQuery, "slug">) =>
    metaFilterKey(["meta", "events", slug, "standings"], query, STANDINGS_FIELDS),
  run: (slug: string, key: string) => ["meta", "events", slug, "runs", key] as const,
  decks: (query?: MetaDeckQuery) => metaFilterKey(["meta", "decks"], query, DECK_QUERY_FIELDS),
  deckFacets: (query?: MetaDeckQuery) =>
    metaFilterKey(["meta", "deck-facets"], query, DECK_FACET_FIELDS),
  deckCards: (query?: MetaDeckCardsQuery) =>
    metaFilterKey(["meta", "deck-cards"], query, DECK_CARDS_FIELDS),
  deck: (token: string) => ["meta", "decks", token] as const,
  legends: (query?: MetaScopeQuery) => metaFilterKey(["meta", "legends"], query, SCOPE_FIELDS),
  legend: (slug: string, query?: MetaScopeQuery & { page?: number }) =>
    metaFilterKey(["meta", "legends", slug], query, LEGEND_QUERY_FIELDS),
  player: (key: string) => ["meta", "players", key] as const,
} as const;

export const metaSubmissionsKeys = {
  all: (userId: string) => ["meta-submissions", userId] as const,
  creditVisibility: (userId: string) => ["meta-submissions", userId, "credit"] as const,
  pendingForEvents: ["meta-pending-submissions"] as const,
  pendingForEvent: (slug: string, userId: string | null) =>
    ["meta-pending-submissions", slug, userId] as const,
} as const;
