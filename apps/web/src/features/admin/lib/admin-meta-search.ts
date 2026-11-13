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

import { lenient } from "@/lib/lenient-param";

/**
 * Every filter is absent at its default, so an untouched tab carries a clean
 * URL and the overview's funnel links stay short.
 */
export const metaSearchSchema = z.object({
  tab: lenient(z.enum(["catalogue", "review", "public"])),
  source: lenient(z.enum(META_CATALOG_PROVIDERS)),
  detail: lenient(z.enum(META_CATALOG_PROVIDERS)),
  page: lenient(z.coerce.number().check(z.int(), z.positive())),
  q: lenient(z.string()),
  triage: lenient(z.union([z.enum(META_CATALOG_TRIAGE), z.literal("any")])),
  eventStatus: lenient(z.enum(META_CATALOG_DISPLAY_STATUSES)),
  plStatus: lenient(z.pipe(z.coerce.number().check(z.int()), z.literal(PLAYLOLTCG_STATUSES))),
  tdFormat: lenient(z.string()),
  prType: lenient(z.enum(PLAYRIFTBOUND_TOURNAMENT_TYPES)),
  prFormat: lenient(z.enum(PLAYRIFTBOUND_FORMATS)),
  eventSort: lenient(z.enum(META_CATALOG_SORTS)),
  eventDir: lenient(z.enum(META_CATALOG_SORT_DIRECTIONS)),
  minPlayers: lenient(z.coerce.number().check(z.int(), z.gte(0))),
  decklists: lenient(z.boolean()),
  missing: lenient(z.boolean()),
  bucket: lenient(z.enum(META_SYNC_BUCKET_FILTERS)),
  dateFrom: lenient(z.string()),
  dateTo: lenient(z.string()),
  liveFormat: lenient(z.string()),
  liveSource: lenient(z.enum(META_EVENT_SOURCE_FILTERS)),
  liveTier: lenient(z.enum(META_EVENT_TIERS)),
  liveResults: lenient(z.enum(META_RESULTS_STATES)),
  liveSort: lenient(z.enum(META_EVENT_SORTS)),
  liveDir: lenient(z.enum(META_EVENT_SORT_DIRECTIONS)),
  incompleteStandings: lenient(z.boolean()),
  hasDecks: lenient(z.boolean()),
});

export type MetaSearch = z.infer<typeof metaSearchSchema>;
