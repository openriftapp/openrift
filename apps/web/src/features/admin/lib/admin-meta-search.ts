import { META_RESULTS_STATES } from "@openrift/shared/meta-results";
import { META_SYNC_BUCKET_FILTERS } from "@openrift/shared/meta-sync-buckets";
import {
  META_CATALOG_DISPLAY_STATUSES,
  META_CATALOG_PROVIDERS,
  META_CATALOG_SORT_DIRECTIONS,
  META_CATALOG_SORTS,
  META_CATALOG_TRIAGE,
  META_EVENT_SORT_DIRECTIONS,
  META_EVENT_SORTS,
  META_EVENT_SOURCE_FILTERS,
  META_EVENT_TIERS,
  PLAYLOLTCG_STATUSES,
  PLAYRIFTBOUND_FORMATS,
  PLAYRIFTBOUND_TOURNAMENT_TYPES,
} from "@openrift/shared/types/enums";
import { z } from "zod/mini";

/**
 * Every filter is absent at its default, so an untouched tab carries a clean
 * URL and the overview's funnel links stay short.
 */
export const metaSearchSchema = z.object({
  tab: z.optional(z.enum(["catalogue", "review", "public"])),
  source: z.optional(z.enum(META_CATALOG_PROVIDERS)),
  detail: z.optional(z.enum(META_CATALOG_PROVIDERS)),
  page: z.optional(z.coerce.number().check(z.int(), z.positive())),
  q: z.optional(z.string()),
  triage: z.optional(z.union([z.enum(META_CATALOG_TRIAGE), z.literal("any")])),
  eventStatus: z.optional(z.enum(META_CATALOG_DISPLAY_STATUSES)),
  plStatus: z.optional(z.pipe(z.coerce.number().check(z.int()), z.literal(PLAYLOLTCG_STATUSES))),
  tdFormat: z.optional(z.string()),
  prType: z.optional(z.enum(PLAYRIFTBOUND_TOURNAMENT_TYPES)),
  prFormat: z.optional(z.enum(PLAYRIFTBOUND_FORMATS)),
  eventSort: z.optional(z.enum(META_CATALOG_SORTS)),
  eventDir: z.optional(z.enum(META_CATALOG_SORT_DIRECTIONS)),
  minPlayers: z.optional(z.coerce.number().check(z.int(), z.gte(0))),
  decklists: z.optional(z.boolean()),
  missing: z.optional(z.boolean()),
  bucket: z.optional(z.enum(META_SYNC_BUCKET_FILTERS)),
  dateFrom: z.optional(z.string()),
  dateTo: z.optional(z.string()),
  liveFormat: z.optional(z.string()),
  liveSource: z.optional(z.enum(META_EVENT_SOURCE_FILTERS)),
  liveTier: z.optional(z.enum(META_EVENT_TIERS)),
  liveResults: z.optional(z.enum(META_RESULTS_STATES)),
  liveSort: z.optional(z.enum(META_EVENT_SORTS)),
  liveDir: z.optional(z.enum(META_EVENT_SORT_DIRECTIONS)),
  incompleteStandings: z.optional(z.boolean()),
  hasDecks: z.optional(z.boolean()),
});

export type MetaSearch = z.infer<typeof metaSearchSchema>;
