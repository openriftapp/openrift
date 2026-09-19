import {
  deckFormatSchema,
  metaEventStatusSchema,
  metaEventTierSchema,
  metaListStatusSchema,
  metaSubmissionKindSchema,
} from "@openrift/shared/response-schemas";
import { isoDate, isoDateTime } from "@openrift/shared/schemas";
import { oc } from "@orpc/contract";
import { z } from "zod";

import { publicDeckDetailResponseSchema } from "./public-decks.js";

const TAG = "Meta archive";
const BASE = "/api/v1/meta";

export const metaCardRefSchema = z.object({
  cardId: z.string(),
  name: z.string(),
  slug: z.string(),
  imageId: z.string().nullable(),
  domains: z.array(z.string()),
  archiveSlug: z.string().nullable(),
});

export const metaEventFinishSchema = z.object({
  rank: z.number().int(),
  rankIsTier: z.boolean(),
  playerName: z.string(),
  playerKey: z.string().nullable(),
  wins: z.number().int().nullable(),
  losses: z.number().int().nullable(),
  draws: z.number().int().nullable(),
  legend: metaCardRefSchema.nullable(),
});

export const metaEventSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  eventDate: isoDate,
  format: deckFormatSchema,
  tier: metaEventTierSchema,
  status: metaEventStatusSchema,
  /** ISO 3166-1 alpha-2. */
  country: z.string().nullable(),
  location: z.string().nullable(),
  playerCount: z.number().int().nullable(),
  organizer: z.string().nullable(),
  playerRowCount: z.number().int().nonnegative(),
  deckCount: z.number().int().nonnegative(),
  topFinishes: z.array(metaEventFinishSchema),
});

export const metaEventSourceSchema = z.object({
  id: z.string(),
  provider: z.string().nullable(),
  externalId: z.string().nullable(),
  label: z.string(),
  sourceUrl: z.string().nullable(),
});

export const metaEventDetailSchema = metaEventSummarySchema.extend({
  notes: z.string().nullable(),
  /** ISO timestamp of the last source read, null for hand-entered events. */
  sourceCheckedAt: z.string().nullable(),
  sources: z.array(metaEventSourceSchema),
  contributors: z.array(z.string()),
});

const metaDeckEventSchema = z.object({
  slug: z.string(),
  name: z.string(),
  eventDate: isoDate,
  format: deckFormatSchema,
  tier: metaEventTierSchema,
  /** ISO 3166-1 alpha-2. */
  country: z.string().nullable(),
});

/**
 * `deckId` and `shareToken` are set exactly for rows with `listStatus !== "none"`.
 */
export const metaEventPlayerSchema = z.object({
  id: z.string(),
  rank: z.number().int(),
  rankIsTier: z.boolean(),
  playerName: z.string(),
  playerKey: z.string().nullable(),
  wins: z.number().int().nullable(),
  losses: z.number().int().nullable(),
  draws: z.number().int().nullable(),
  legend: metaCardRefSchema.nullable(),
  champion: metaCardRefSchema.nullable(),
  deckId: z.string().nullable(),
  deckName: z.string().nullable(),
  shareToken: z.string().nullable(),
  listStatus: metaListStatusSchema,
});

export const metaRunOutcomeSchema = z.enum(["win", "loss", "draw", "bye", "unknown"]);

/** Round numbers restart with each phase, so `phaseOrder` is what tells two rounds apart. */
export const metaStandingsRoundSchema = z.object({
  phaseOrder: z.number().int(),
  roundNumber: z.number().int(),
  isCut: z.boolean(),
  outcome: metaRunOutcomeSchema,
});

export const metaStandingsRowSchema = metaEventPlayerSchema.extend({
  rounds: z.array(metaStandingsRoundSchema),
});

export const metaRunRoundSchema = z.object({
  phaseOrder: z.number().int(),
  roundNumber: z.number().int(),
  isCut: z.boolean(),
  tableNumber: z.number().int().nullable(),
  outcome: metaRunOutcomeSchema,
  gamesWon: z.number().int().nullable(),
  gamesLost: z.number().int().nullable(),
  opponentId: z.string().nullable(),
});

/**
 * Distinguishes a cut from the Swiss rounds before it: match rows carry only
 * `phaseOrder`, so infer the stage from this, not from round shape.
 */
export const metaEventPhaseSchema = z.object({
  phaseOrder: z.number().int(),
  name: z.string().nullable(),
  roundType: z.string(),
  roundCount: z.number().int().nullable(),
  rankRequired: z.number().int().nullable(),
  maxGameWins: z.number().int().nullable(),
});

/** Per-match facts only; no aggregate is computed or served from here. */
export const metaEventMatchSchema = z.object({
  phaseOrder: z.number().int(),
  roundNumber: z.number().int(),
  tableNumber: z.number().int().nullable(),
  isBye: z.boolean(),
  isDraw: z.boolean(),
  player1Id: z.string(),
  player2Id: z.string().nullable(),
  winnerId: z.string().nullable(),
  gamesWonP1: z.number().int().nullable(),
  gamesWonP2: z.number().int().nullable(),
});

export const metaDeckSummarySchema = z.object({
  playerId: z.string(),
  deckId: z.string(),
  shareToken: z.string(),
  listStatus: metaListStatusSchema,
  name: z.string(),
  format: deckFormatSchema,
  legendCardId: z.string().nullable(),
  legendName: z.string().nullable(),
  legendSlug: z.string().nullable(),
  legendArchiveSlug: z.string().nullable(),
  legendImageId: z.string().nullable(),
  championCardId: z.string().nullable(),
  championName: z.string().nullable(),
  championImageId: z.string().nullable(),
  playerName: z.string(),
  playerKey: z.string().nullable(),
  rank: z.number().int(),
  rankIsTier: z.boolean(),
  wins: z.number().int().nullable(),
  losses: z.number().int().nullable(),
  draws: z.number().int().nullable(),
  event: metaDeckEventSchema,
});

/** One page of the event index, with the count the whole filter matches. */
export const metaEventListResponseSchema = z.object({
  events: z.array(metaEventSummarySchema),
  total: z.number().int().nonnegative(),
});

const metaEventFacetValueSchema = z.object({
  value: z.string(),
  count: z.number().int().nonnegative(),
});

/**
 * Each facet's values are counted with every other narrowing applied and the
 * facet's own picks lifted. `holdings` and `totals` carry the whole filter.
 */
export const metaEventFacetsResponseSchema = z.object({
  formats: z.array(metaEventFacetValueSchema),
  tiers: z.array(metaEventFacetValueSchema),
  countries: z.array(metaEventFacetValueSchema),
  holdings: z.object({
    all: z.number().int().nonnegative(),
    decks: z.number().int().nonnegative(),
    standings: z.number().int().nonnegative(),
    upcoming: z.number().int().nonnegative(),
    resultless: z.number().int().nonnegative(),
  }),
  totals: z.object({
    events: z.number().int().nonnegative(),
    playerRows: z.number().int().nonnegative(),
    decks: z.number().int().nonnegative(),
  }),
});

export const metaActivityKindSchema = z.enum(["event-added", "decks-added", "results-added"]);

/**
 * Additions are reported as bursts: rows of one kind landing on one event
 * within a UTC day collapse into one item.
 */
export const metaActivityItemSchema = z.object({
  kind: metaActivityKindSchema,
  occurredAt: isoDateTime,
  count: z.number().int().positive().nullable(),
  event: z.object({ slug: z.string(), name: z.string() }),
});

/** Newest first. */
export const metaActivityResponseSchema = z.object({ items: z.array(metaActivityItemSchema) });

/** One page of an event's standings, best finish first. */
export const metaEventStandingsResponseSchema = z.object({
  players: z.array(metaStandingsRowSchema),
  total: z.number().int().nonnegative(),
});

/** Computed over the whole field, never over one page of standings rows. */
export const metaEventFieldSchema = z.object({
  withLists: z.number().int().nonnegative(),
  hasLegends: z.boolean(),
  hasRecords: z.boolean(),
  hasRuns: z.boolean(),
  legends: z.array(
    z.object({
      cardId: z.string(),
      name: z.string(),
      count: z.number().int().positive(),
    }),
  ),
  cutLine: z
    .object({
      wins: z.number().int().nullable(),
      losses: z.number().int().nullable(),
      draws: z.number().int().nullable(),
    })
    .nullable(),
  progress: z.object({ phaseOrder: z.number().int(), roundNumber: z.number().int() }).nullable(),
});

/** Match rows are served for the cut only. A player's own rounds ride on their standings row. */
export const metaEventDetailResponseSchema = z.object({
  event: metaEventDetailSchema,
  standings: metaEventStandingsResponseSchema,
  field: metaEventFieldSchema,
  bestPerLegend: z.array(metaStandingsRowSchema),
  cutMatches: z.array(metaEventMatchSchema),
  phases: z.array(metaEventPhaseSchema),
});

// `z.coerce.number()` accepts 1e30, which postgres.js sends in exponent form and
// Postgres rejects. Every paged input is bounded before it reaches a query.
export const MAX_OFFSET = 1_000_000;

export const MAX_FACET_VALUES = 300;

const pageOffset = z.coerce.number().int().nonnegative().max(MAX_OFFSET).optional();

// The event payload carries this many rows, and the web seeds its cache under a
// key built from it, so a change here silently mismatches that key on both sides.
export const STANDINGS_PAGE_SIZE = 200;

/** The page sizes a list's picker offers. */
export const META_PAGE_SIZES = [50, 100, 200, 500] as const;

/** The largest page a list serves, which is the largest size its picker offers. */
export const META_MAX_LIST_PAGE_SIZE = Math.max(...META_PAGE_SIZES);

/** The whole field of the largest event the archive holds, for a reader who asked for all of it. */
export const META_MAX_PAGE_SIZE = 5000;

const listLimit = z.coerce.number().int().positive().max(META_MAX_LIST_PAGE_SIZE).optional();

export const metaEventStandingsQuerySchema = z.object({
  slug: z.string().min(1),
  q: z.string().max(200).optional(),
  list: z.literal("with").optional(),
  legend: z.uuid().optional(),
  limit: z.coerce.number().int().positive().max(META_MAX_PAGE_SIZE).optional(),
  offset: pageOffset,
});

export const metaEventRunResponseSchema = z.object({
  event: metaEventSummarySchema,
  phases: z.array(metaEventPhaseSchema),
  player: metaStandingsRowSchema,
  rounds: z.array(metaRunRoundSchema),
  opponents: z.array(metaEventPlayerSchema),
  lastCutRound: z.number().int().nullable(),
  /** Null when the cut's last round held more than one match: nothing says which was the title. */
  finalRoundNumber: z.number().int().nullable(),
});

export const metaPendingSubmissionSchema = z.object({
  id: z.string(),
  kind: metaSubmissionKindSchema,
  metaEventPlayerId: z.string().nullable(),
  playerName: z.string().nullable(),
  rank: z.number().int().nullable(),
  rankIsTier: z.boolean().nullable(),
  mine: z.boolean(),
});

export const metaPendingSubmissionsResponseSchema = z.object({
  items: z.array(metaPendingSubmissionSchema),
});

/**
 * `events` carries a summary for every event the returned decks were played at,
 * and nothing else. `total` counts every deck the filter matched and
 * `eventCount` the events that match spans, `archiveTotal` the archive's decks
 * whatever the filter.
 */
export const metaDeckListResponseSchema = z.object({
  decks: z.array(metaDeckSummarySchema),
  events: z.array(metaEventSummarySchema),
  total: z.number().int().nonnegative(),
  eventCount: z.number().int().nonnegative(),
  archiveTotal: z.number().int().nonnegative(),
});

/**
 * `cards` is a pooled id list referenced by index. `entries`/`sideboard` are
 * flat `[cardIndex, quantity]` runs; every zone but the sideboard sums into `entries`.
 */
export const metaDeckCardIndexResponseSchema = z.object({
  cards: z.array(z.string()),
  decks: z.array(
    z.object({
      deckId: z.string(),
      entries: z.array(z.number().int().nonnegative()),
      sideboard: z.array(z.number().int().nonnegative()),
    }),
  ),
});

/**
 * Same shape as `/decks/share/{token}`'s response; the share page's renderer
 * depends on this.
 */
export const metaDeckDetailResponseSchema = publicDeckDetailResponseSchema.extend({
  meta: z.object({
    event: metaDeckEventSchema.extend({ playerCount: z.number().int().nullable() }),
    listStatus: metaListStatusSchema,
    playerName: z.string(),
    playerKey: z.string().nullable(),
    rank: z.number().int(),
    rankIsTier: z.boolean(),
    wins: z.number().int().nullable(),
    losses: z.number().int().nullable(),
    draws: z.number().int().nullable(),
    contributors: z.array(z.string()),
  }),
});

/**
 * `decksWithMainDeck` counts full and partial lists alike (a partial list's
 * main deck is complete). `totalEvents` and `eventsByTier` ignore the query's filters.
 */
export const metaCountsResponseSchema = z.object({
  totalPlayers: z.number().int().nonnegative(),
  decksWithMainDeck: z.number().int().nonnegative(),
  totalEvents: z.number().int().nonnegative(),
  eventsByTier: z.object({
    premier: z.number().int().nonnegative(),
    competitive: z.number().int().nonnegative(),
    local: z.number().int().nonnegative(),
  }),
});

const metaLegendEventSchema = z.object({
  slug: z.string(),
  name: z.string(),
  eventDate: isoDate,
  format: deckFormatSchema,
  tier: metaEventTierSchema,
  country: z.string().nullable(),
  playerCount: z.number().int().nullable(),
});

/** `shareToken` is set exactly for rows with `listStatus !== "none"`. */
export const metaLegendFinishSchema = z.object({
  playerId: z.string(),
  rank: z.number().int(),
  rankIsTier: z.boolean(),
  playerName: z.string(),
  playerKey: z.string().nullable(),
  wins: z.number().int().nullable(),
  losses: z.number().int().nullable(),
  draws: z.number().int().nullable(),
  shareToken: z.string().nullable(),
  listStatus: metaListStatusSchema,
  event: metaLegendEventSchema,
});

/**
 * Every number is a raw count: the archive never serves a rate or a share.
 * `eventWins` counts events, so a shared first place at one event is one win.
 */
export const metaLegendSummarySchema = z.object({
  slug: z.string(),
  legend: metaCardRefSchema,
  bestFinish: z.object({
    rank: z.number().int(),
    rankIsTier: z.boolean(),
    event: metaLegendEventSchema,
  }),
  finishes: z.number().int().nonnegative(),
  decklists: z.number().int().nonnegative(),
  eventWins: z.number().int().nonnegative(),
});

/**
 * `legends` is the whole scoped list, never a page, and `total` counts it.
 * `archiveTotal` counts the archive's legends whatever the scope.
 */
export const metaLegendListResponseSchema = z.object({
  legends: z.array(metaLegendSummarySchema),
  total: z.number().int().nonnegative(),
  archiveTotal: z.number().int().nonnegative(),
  countries: z.array(z.string()),
});

/** Facts only: never a rate, a share, or a comparison against another legend. */
export const metaLegendDetailResponseSchema = z.object({
  slug: z.string(),
  legend: metaCardRefSchema,
  counts: z.object({
    wins: z.number().int().nonnegative(),
    finishes: z.number().int().nonnegative(),
    decklists: z.number().int().nonnegative(),
  }),
  best: z.array(metaLegendFinishSchema),
  finishes: z.array(metaLegendFinishSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
});

export const metaPlayerFinishSchema = z.object({
  playerId: z.string(),
  rank: z.number().int(),
  rankIsTier: z.boolean(),
  wins: z.number().int().nullable(),
  losses: z.number().int().nullable(),
  draws: z.number().int().nullable(),
  shareToken: z.string().nullable(),
  listStatus: metaListStatusSchema,
  legend: metaCardRefSchema.nullable(),
  event: metaLegendEventSchema,
});

/** Facts only: never a rate or a comparison against another player. */
export const metaPlayerDetailResponseSchema = z.object({
  key: z.string(),
  name: z.string(),
  finishes: z.array(metaPlayerFinishSchema),
});

export const metaCountsQuerySchema = z.object({
  format: z.string().min(1).optional(),
  dateFrom: isoDate.optional(),
  dateTo: isoDate.optional(),
});

/** Inclusive bounds; both ends are optional and independent. */
export const metaDateRangeQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
});

/**
 * Plain strings, not the tier/format enums. A stale bookmark naming a
 * retired value narrows to nothing; the request still succeeds.
 */
const scopeFacetList = z.array(z.string().min(1)).max(MAX_FACET_VALUES).optional();

/**
 * Each facet is an include list or an exclude list, never both. An event
 * with no value for a facet is outside every include list and inside every exclude list.
 */
export const metaScopeQuerySchema = metaDateRangeQuerySchema.extend({
  formats: scopeFacetList,
  formatsEx: scopeFacetList,
  tiers: scopeFacetList,
  tiersEx: scopeFacetList,
  countries: scopeFacetList,
  countriesEx: scopeFacetList,
});

export const META_EVENT_HOLDINGS = ["decks", "standings", "upcoming", "resultless"] as const;

/** Everything the event index narrows by: the scope bar, plus the page's own controls. */
export const metaEventFilterQuerySchema = metaScopeQuerySchema.extend({
  /** One event by its own slug, for a surface holding a link and nothing else. */
  slug: z.string().min(1).optional(),
  q: z.string().max(200).optional(),
  holds: z.enum(META_EVENT_HOLDINGS).optional(),
  playersMin: z.coerce.number().int().nonnegative().optional(),
  playersMax: z.coerce.number().int().nonnegative().optional(),
});

export const META_EVENT_INDEX_SORTS = [
  "date",
  "name",
  "tier",
  "country",
  "players",
  "decks",
] as const;

export const metaEventListQuerySchema = metaEventFilterQuerySchema.extend({
  by: z.enum(META_EVENT_INDEX_SORTS).optional(),
  dir: z.enum(["asc", "desc"]).optional(),
  limit: listLimit,
  offset: pageOffset,
});

/** No `from`/`to`: the era is summed client-side from the per-day counts this feeds. */
export const metaEventDayCountsQuerySchema = metaEventFilterQuerySchema.omit({
  from: true,
  to: true,
  slug: true,
});

export const metaEventDayCountsResponseSchema = z.object({
  days: z.record(isoDate, z.number().int().nonnegative()),
});

export const META_DECK_SORTS = ["date", "finish"] as const;

/** `curated` keeps one deck per legend per event, the best finish of each. */
export const metaDeckQuerySchema = metaScopeQuerySchema.extend({
  legend: z.uuid().optional(),
  player: z.string().min(1).optional(),
  events: z.array(z.string().min(1)).max(MAX_FACET_VALUES).optional(),
  legends: z.array(z.uuid()).max(MAX_FACET_VALUES).optional(),
  maxRank: z.coerce.number().int().positive().optional(),
  // Not `z.coerce.boolean()`: that is `Boolean(value)`, so `curated=false` arrives as true.
  curated: z.union([z.boolean(), z.stringbool()]).optional(),
  by: z.enum(META_DECK_SORTS).optional(),
  dir: z.enum(["asc", "desc"]).optional(),
  limit: listLimit,
  offset: pageOffset,
});

/** A caller names what it shows: one event's field, or the page of the browser it is pricing. */
export const metaDeckCardsQuerySchema = metaDeckQuerySchema.extend({
  event: z.string().min(1).optional(),
});

/** The deck browser's filter, without the axis a facet counts its own values on. */
export const metaDeckFacetsQuerySchema = metaDeckQuerySchema.omit({
  by: true,
  dir: true,
  limit: true,
  offset: true,
});

const metaDeckFacetValueSchema = z.object({
  value: z.string(),
  label: z.string(),
  count: z.number().int().nonnegative(),
});

/**
 * Each facet's values are counted with every other narrowing applied, its own
 * picks lifted, and the same curation the grid renders. A picked value the rest
 * of the narrowing counts no row for comes back at count 0. `events` stops at
 * the cap `metaDeckQuerySchema.events` accepts back.
 */
export const metaDeckFacetsResponseSchema = z.object({
  events: z.array(metaDeckFacetValueSchema).max(MAX_FACET_VALUES),
  legends: z.array(metaDeckFacetValueSchema),
  finishes: z.array(z.object({ value: z.number().int(), count: z.number().int().nonnegative() })),
  /** ISO 3166-1 alpha-2 */
  countries: z.array(z.string()),
});

export const metaLegendQuerySchema = metaScopeQuerySchema.extend({
  slug: z.string().min(1),
  page: z.coerce.number().int().min(1).max(MAX_OFFSET).optional(),
});

/**
 * oRPC contract for the public meta archive, mounted under `/api/v1/meta`.
 * Every route is anonymous (`auth: "public"`) and SSR-facing.
 *
 * `deck` 404s for a share token that resolves to a deck outside the archive,
 * so a regular user's shared deck can never be rendered as an archive entry.
 */
export const metaContract = {
  events: oc
    .route({ method: "GET", path: `${BASE}/events`, tags: [TAG] })
    .meta({ auth: "public", cache: "medium", etag: true })
    .input(metaEventListQuerySchema)
    .output(metaEventListResponseSchema),

  eventFacets: oc
    .route({ method: "GET", path: `${BASE}/events/facets`, tags: [TAG] })
    .meta({ auth: "public", cache: "medium", etag: true })
    .input(metaEventFilterQuerySchema)
    .output(metaEventFacetsResponseSchema),

  eventDayCounts: oc
    .route({ method: "GET", path: `${BASE}/events/day-counts`, tags: [TAG] })
    .meta({ auth: "public", cache: "short" })
    .input(metaEventDayCountsQuerySchema)
    .output(metaEventDayCountsResponseSchema),

  activity: oc
    .route({ method: "GET", path: `${BASE}/activity`, tags: [TAG] })
    .meta({ auth: "public", cache: "short" })
    .output(metaActivityResponseSchema),

  event: oc
    .route({ method: "GET", path: `${BASE}/events/{slug}`, tags: [TAG] })
    .meta({ auth: "public", cache: "medium", etag: true })
    .input(z.object({ slug: z.string().min(1) }))
    .errors({ NOT_FOUND: { message: "Event not found" } })
    .output(metaEventDetailResponseSchema),

  standings: oc
    .route({ method: "GET", path: `${BASE}/events/{slug}/standings`, tags: [TAG] })
    .meta({ auth: "public", cache: "medium", etag: true })
    .input(metaEventStandingsQuerySchema)
    .errors({ NOT_FOUND: { message: "Event not found" } })
    .output(metaEventStandingsResponseSchema),

  run: oc
    .route({ method: "GET", path: `${BASE}/events/{slug}/players/{key}/run`, tags: [TAG] })
    .meta({ auth: "public", cache: "medium", etag: true })
    .input(z.object({ slug: z.string().min(1), key: z.string().min(1) }))
    .errors({ NOT_FOUND: { message: "Player not found" } })
    .output(metaEventRunResponseSchema),

  pendingSubmissions: oc
    .route({ method: "GET", path: `${BASE}/events/{slug}/pending-submissions`, tags: [TAG] })
    .meta({ auth: "public", cache: "short", cacheVary: "viewer" })
    .input(z.object({ slug: z.string().min(1) }))
    .errors({ NOT_FOUND: { message: "Event not found" } })
    .output(metaPendingSubmissionsResponseSchema),

  decks: oc
    .route({ method: "GET", path: `${BASE}/decks`, tags: [TAG] })
    .meta({ auth: "public", cache: "medium", etag: true })
    .input(metaDeckQuerySchema)
    .output(metaDeckListResponseSchema),

  deckFacets: oc
    .route({ method: "GET", path: `${BASE}/decks/facets`, tags: [TAG] })
    .meta({ auth: "public", cache: "medium", etag: true })
    .input(metaDeckFacetsQuerySchema)
    .output(metaDeckFacetsResponseSchema),

  deckCards: oc
    .route({ method: "GET", path: `${BASE}/deck-cards`, tags: [TAG] })
    .meta({ auth: "public", cache: "medium", etag: true })
    .input(metaDeckCardsQuerySchema)
    .output(metaDeckCardIndexResponseSchema),

  deck: oc
    .route({ method: "GET", path: `${BASE}/decks/{token}`, tags: [TAG] })
    .meta({ auth: "public", cache: "short" })
    .input(z.object({ token: z.string().min(1) }))
    .errors({ NOT_FOUND: { message: "Deck not found" } })
    .output(metaDeckDetailResponseSchema),

  legends: oc
    .route({ method: "GET", path: `${BASE}/legends`, tags: [TAG] })
    .meta({ auth: "public", cache: "medium", etag: true })
    .input(metaScopeQuerySchema)
    .output(metaLegendListResponseSchema),

  legend: oc
    .route({ method: "GET", path: `${BASE}/legends/{slug}`, tags: [TAG] })
    .meta({ auth: "public", cache: "medium", etag: true })
    .input(metaLegendQuerySchema)
    .errors({ NOT_FOUND: { message: "Legend not found" } })
    .output(metaLegendDetailResponseSchema),

  player: oc
    .route({ method: "GET", path: `${BASE}/players/{key}`, tags: [TAG] })
    .meta({ auth: "public", cache: "medium", etag: true })
    .input(z.object({ key: z.string().min(1) }))
    .errors({ NOT_FOUND: { message: "Player not found" } })
    .output(metaPlayerDetailResponseSchema),

  counts: oc
    .route({ method: "GET", path: `${BASE}/counts`, tags: [TAG] })
    .meta({ auth: "public", cache: "short" })
    .input(metaCountsQuerySchema)
    .output(metaCountsResponseSchema),
};

export type MetaContract = typeof metaContract;
