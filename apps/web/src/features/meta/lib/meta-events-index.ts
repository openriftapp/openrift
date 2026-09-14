import { todayUtc } from "@openrift/shared/set-release";
import type { MetaEventSummary } from "@openrift/shared/types/api/meta";
import type { MetaEventTier } from "@openrift/shared/types/enums";

import type {
  MetaEventHoldings,
  MetaEventIndexSort,
  MetaEventIndexSortDirection,
} from "@/features/meta/lib/meta-events-search";
import {
  DEFAULT_EVENT_DIRECTION,
  DEFAULT_EVENT_SORT,
} from "@/features/meta/lib/meta-events-search";
import type { MetaEra, MetaScope } from "@/features/meta/lib/meta-scope";
import type { ScopeFacetCounts } from "@/features/meta/lib/meta-scope-match";
import { scopeFacetCounts, scopeMatches } from "@/features/meta/lib/meta-scope-match";
import { normalizeCountryCode } from "@/lib/country";

const TIER_RANK: Record<MetaEventTier, number> = {
  premier: 0,
  competitive: 1,
  local: 2,
};

export function metaEventCountries(events: readonly MetaEventSummary[]): string[] {
  const codes = new Set<string>();
  for (const event of events) {
    const code = normalizeCountryCode(event.country);
    if (code !== null) {
      codes.add(code.toUpperCase());
    }
  }
  return [...codes].sort((left, right) => left.localeCompare(right));
}

export interface MetaEventIndexFilter {
  query?: string;
  scope: MetaScope;
  eras: readonly MetaEra[];
  holds?: MetaEventHoldings;
  playersMin?: number;
  playersMax?: number;
  today?: string;
}

export function filterMetaEvents(
  events: readonly MetaEventSummary[],
  filter: MetaEventIndexFilter,
): MetaEventSummary[] {
  const keep = outsideScope(filter);
  return events.filter((event) => keep(event) && scopeMatches(event, filter.scope, filter.eras));
}

export function metaEventFacetCounts(
  events: readonly MetaEventSummary[],
  filter: MetaEventIndexFilter,
): ScopeFacetCounts {
  return scopeFacetCounts(events, filter.scope, filter.eras, {}, outsideScope(filter));
}

/** How many events each holdings choice would show, with everything else applied. */
export function metaEventHoldingsCounts(
  events: readonly MetaEventSummary[],
  filter: MetaEventIndexFilter,
): Map<MetaEventHoldings | "", number> {
  const today = filter.today ?? todayUtc();
  const keep = outsideScope({ ...filter, holds: undefined });
  const counts = new Map<MetaEventHoldings | "", number>();
  const bump = (key: MetaEventHoldings | "") => counts.set(key, (counts.get(key) ?? 0) + 1);
  for (const event of events) {
    if (!keep(event) || !scopeMatches(event, filter.scope, filter.eras)) {
      continue;
    }
    bump("");
    for (const holds of ["decks", "standings", "upcoming"] as const) {
      if (holdsEnough(event, holds, today)) {
        bump(holds);
      }
    }
  }
  return counts;
}

/** The page's own narrowing, everything but the scope bar's facets. */
function outsideScope(filter: MetaEventIndexFilter): (event: MetaEventSummary) => boolean {
  const needle = (filter.query ?? "").trim().toLowerCase();
  const today = filter.today ?? todayUtc();
  return (event) =>
    (needle === "" || matchesText(event, needle)) &&
    holdsEnough(event, filter.holds, today) &&
    playersWithin(event, filter.playersMin, filter.playersMax);
}

function holdsEnough(
  event: MetaEventSummary,
  holds: MetaEventHoldings | undefined,
  today: string,
): boolean {
  if (holds === "decks") {
    return event.deckCount > 0;
  }
  if (holds === "standings") {
    return event.playerRowCount > 0;
  }
  if (holds === "upcoming") {
    return event.eventDate > today;
  }
  return true;
}

/** A bound needs a known head count; an event without one is dropped once either bound is set. */
function playersWithin(event: MetaEventSummary, min?: number, max?: number): boolean {
  if (min === undefined && max === undefined) {
    return true;
  }
  if (event.playerCount === null) {
    return false;
  }
  return (
    (min === undefined || event.playerCount >= min) &&
    (max === undefined || event.playerCount <= max)
  );
}

function matchesText(event: MetaEventSummary, needle: string): boolean {
  return [event.name, event.organizer, event.location].some(
    (field) => field !== null && field.toLowerCase().includes(needle),
  );
}

/** Ties break by event name for a stable render order. */
export function sortMetaEvents(
  events: readonly MetaEventSummary[],
  sort: MetaEventIndexSort = DEFAULT_EVENT_SORT,
  direction: MetaEventIndexSortDirection = DEFAULT_EVENT_DIRECTION,
): MetaEventSummary[] {
  const sign = direction === "asc" ? 1 : -1;
  return events.toSorted((left, right) => {
    const missing = compareMissing(sort, left, right);
    if (missing !== 0) {
      return missing;
    }
    const primary = compareValues(sort, left, right);
    if (primary !== 0) {
      return primary * sign;
    }
    return left.name.localeCompare(right.name);
  });
}

/** Sorted outside the direction, so an unrecorded country stays at the bottom either way. */
function compareMissing(
  sort: MetaEventIndexSort,
  left: MetaEventSummary,
  right: MetaEventSummary,
): number {
  if (sort !== "country") {
    return 0;
  }
  const leftHas = normalizeCountryCode(left.country) !== null;
  const rightHas = normalizeCountryCode(right.country) !== null;
  if (leftHas === rightHas) {
    return 0;
  }
  return leftHas ? -1 : 1;
}

function compareValues(
  sort: MetaEventIndexSort,
  left: MetaEventSummary,
  right: MetaEventSummary,
): number {
  switch (sort) {
    case "name": {
      return left.name.localeCompare(right.name);
    }
    case "tier": {
      return TIER_RANK[left.tier] - TIER_RANK[right.tier];
    }
    case "country": {
      return (normalizeCountryCode(left.country) ?? "").localeCompare(
        normalizeCountryCode(right.country) ?? "",
      );
    }
    case "players": {
      return left.playerRowCount - right.playerRowCount;
    }
    case "decks": {
      return left.deckCount - right.deckCount;
    }
    default: {
      return left.eventDate.localeCompare(right.eventDate);
    }
  }
}

export function nextEventSort(
  current: { sort: MetaEventIndexSort; direction: MetaEventIndexSortDirection },
  column: MetaEventIndexSort,
): { sort: MetaEventIndexSort; direction: MetaEventIndexSortDirection } {
  if (current.sort === column) {
    return { sort: column, direction: current.direction === "asc" ? "desc" : "asc" };
  }
  return { sort: column, direction: DESCENDING_FIRST.has(column) ? "desc" : "asc" };
}

const DESCENDING_FIRST = new Set<MetaEventIndexSort>(["date", "players", "decks"]);
