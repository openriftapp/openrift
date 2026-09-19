import type {
  MetaEventFilterQuery,
  MetaEventFinish,
  MetaEventListQuery,
  MetaEventSummary,
} from "@openrift/shared/types/api/meta";
import type { MetaEventTier } from "@openrift/shared/types/enums";

export function metaEventWinners(event: MetaEventSummary): MetaEventFinish[] {
  return event.topFinishes.filter((finish) => finish.rank === 1);
}

/** How many events each front-page section shows before its "see all" link takes over. */
export const META_FRONT_SECTION_LIMITS = {
  premier: 3,
  competitive: 4,
  local: 5,
  upcoming: 6,
} as const satisfies Record<MetaEventTier | "upcoming", number>;

/** A section asks for its own tier, so the scope's tier picks have to gate the section itself. */
export function metaFrontSectionShown(filters: MetaEventFilterQuery, tier: MetaEventTier): boolean {
  const included = filters.tiers ?? [];
  return included.length > 0 ? included.includes(tier) : !(filters.tiersEx ?? []).includes(tier);
}

/**
 * One tier's section: the newest events that have standings, or that have
 * decklists when the reader is asking only for those.
 */
export function metaFrontSectionQuery(
  filters: MetaEventFilterQuery,
  tier: MetaEventTier,
): MetaEventListQuery {
  return {
    ...filters,
    tiers: [tier],
    tiersEx: undefined,
    holds: filters.holds === "decks" ? "decks" : "standings",
    by: "date",
    dir: "desc",
    limit: META_FRONT_SECTION_LIMITS[tier],
  };
}

export function metaFrontUpcomingQuery(filters: MetaEventFilterQuery): MetaEventListQuery {
  return {
    ...filters,
    holds: "upcoming",
    by: "date",
    dir: "asc",
    limit: META_FRONT_SECTION_LIMITS.upcoming,
  };
}
