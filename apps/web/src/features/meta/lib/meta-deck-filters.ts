import type { MetaDeckQuery, MetaDeckSummary } from "@openrift/shared/types/api/meta";

import type { MetaDeckCost } from "@/features/meta/lib/meta-deck-collection";
import type { MetaDeckSort, MetaDeckSortDirection } from "@/features/meta/lib/meta-deck-search";
import { DEFAULT_DECK_DIRECTION, DEFAULT_DECK_SORT } from "@/features/meta/lib/meta-deck-search";
import type { MetaEra, MetaScope, ScopeFacetDefaults } from "@/features/meta/lib/meta-scope";
import { isScopeCustomized, metaScopeQueryFromScope } from "@/features/meta/lib/meta-scope";
import { m } from "@/paraglide/messages.js";

const DEFAULT_DECK_TIERS: readonly string[] = ["premier", "competitive"];

export const DECK_SCOPE_DEFAULTS: ScopeFacetDefaults = { tiers: DEFAULT_DECK_TIERS };

/** What "any filter is on" is read off, whichever surface asks. */
export interface MetaDeckFilterValues {
  scope: MetaScope;
  events: string[];
  legends: string[];
  maxRank: number | null;
  maxCost: number | null;
  valueMin: number | null;
  valueMax: number | null;
}

export function metaFinishOptions(): { value: number; label: string }[] {
  return [
    { value: 1, label: m.meta_finish_winner() },
    { value: 4, label: m.meta_finish_top_4() },
    { value: 8, label: m.meta_finish_top_8() },
    { value: 16, label: m.meta_finish_top_16() },
  ];
}

export interface MetaDeckNarrowing {
  scope: MetaScope;
  events: string[];
  legends: string[];
  maxRank: number | null;
  showAll: boolean;
}

/** The browser's narrowing as the API takes it, the scope bar's facets included. */
export function metaDeckQueryFromFilters(
  filters: MetaDeckNarrowing,
  eras: readonly MetaEra[],
): MetaDeckQuery {
  const query: MetaDeckQuery = metaScopeQueryFromScope(filters.scope, eras, DECK_SCOPE_DEFAULTS);
  if (filters.events.length > 0) {
    query.events = [...filters.events];
  }
  if (filters.legends.length > 0) {
    query.legends = [...filters.legends];
  }
  if (filters.maxRank !== null) {
    query.maxRank = filters.maxRank;
  }
  if (!filters.showAll) {
    query.curated = true;
  }
  return query;
}

/** What the browser prices itself, and so narrows on the page it is showing. */
export interface MetaDeckCostFilterValues {
  maxCost: number | null;
  valueMin: number | null;
  valueMax: number | null;
}

/**
 * Inert until the costs load, so a shared `?cost=` link does not open on an
 * empty grid while the bridge answers.
 */
export function filterDecksByCost(
  decks: readonly MetaDeckSummary[],
  filters: MetaDeckCostFilterValues,
  costs: ReadonlyMap<string, MetaDeckCost> | undefined,
): MetaDeckSummary[] {
  if (costs === undefined) {
    return [...decks];
  }
  return decks.filter((deck) => {
    const cost = costs.get(deck.deckId);
    if (filters.maxCost !== null) {
      const toComplete = cost?.toComplete;
      if (toComplete === undefined || toComplete > filters.maxCost) {
        return false;
      }
    }
    if (filters.valueMin === null && filters.valueMax === null) {
      return true;
    }
    const value = cost?.value;
    return (
      value !== undefined &&
      (filters.valueMin === null || value >= filters.valueMin) &&
      (filters.valueMax === null || value <= filters.valueMax)
    );
  });
}

/** A deck whose value or cost is not known yet sorts last whichever way the column runs. */
export function sortMetaDecks(
  decks: readonly MetaDeckSummary[],
  sort: MetaDeckSort = DEFAULT_DECK_SORT,
  direction: MetaDeckSortDirection = DEFAULT_DECK_DIRECTION,
  costs?: ReadonlyMap<string, MetaDeckCost>,
): MetaDeckSummary[] {
  const sign = direction === "asc" ? 1 : -1;
  const priced = (deck: MetaDeckSummary): number | undefined => {
    const cost = costs?.get(deck.deckId);
    return sort === "value" ? cost?.value : cost?.toComplete;
  };
  return decks.toSorted((left, right) => {
    if (sort === "value" || sort === "cost") {
      const leftPrice = priced(left);
      const rightPrice = priced(right);
      if (leftPrice === undefined || rightPrice === undefined) {
        if (leftPrice !== rightPrice) {
          return leftPrice === undefined ? 1 : -1;
        }
      } else if (leftPrice !== rightPrice) {
        return (leftPrice - rightPrice) * sign;
      }
    } else if (sort === "finish" && left.rank !== right.rank) {
      return (left.rank - right.rank) * sign;
    }
    if (left.event.eventDate !== right.event.eventDate) {
      const newestFirst = left.event.eventDate < right.event.eventDate ? 1 : -1;
      return sort === "date" ? newestFirst * -sign : newestFirst;
    }
    if (left.event.slug !== right.event.slug) {
      return left.event.slug < right.event.slug ? -1 : 1;
    }
    if (left.rank !== right.rank) {
      return left.rank - right.rank;
    }
    return left.playerName.localeCompare(right.playerName);
  });
}

export function nextDeckSort(
  current: { sort: MetaDeckSort; direction: MetaDeckSortDirection },
  column: MetaDeckSort,
): { sort: MetaDeckSort; direction: MetaDeckSortDirection } {
  if (current.sort === column) {
    return { sort: column, direction: current.direction === "asc" ? "desc" : "asc" };
  }
  return { sort: column, direction: column === "date" ? "desc" : "asc" };
}

export interface MetaDeckEventGroup {
  event: MetaDeckSummary["event"];
  decks: MetaDeckSummary[];
}

/** Groups consecutive runs only, so the decks must already be sorted with each event's lists together. */
export function groupDecksByEvent(decks: readonly MetaDeckSummary[]): MetaDeckEventGroup[] {
  const groups: MetaDeckEventGroup[] = [];
  for (const deck of decks) {
    const last = groups.at(-1);
    if (last !== undefined && last.event.slug === deck.event.slug) {
      last.decks.push(deck);
    } else {
      groups.push({ event: deck.event, decks: [deck] });
    }
  }
  return groups;
}

export function metaDeckSortPresets(): {
  sort: MetaDeckSort;
  direction: MetaDeckSortDirection;
  label: string;
}[] {
  return [
    { sort: "date", direction: "desc", label: m.meta_sort_newest_first() },
    { sort: "date", direction: "asc", label: m.meta_sort_oldest_first() },
    { sort: "finish", direction: "asc", label: m.meta_sort_best_finish() },
    { sort: "cost", direction: "asc", label: m.meta_sort_cheapest() },
    { sort: "value", direction: "asc", label: m.meta_sort_lowest_value() },
    { sort: "value", direction: "desc", label: m.meta_sort_highest_value() },
  ];
}

export function hasActiveMetaDeckFilters(filters: MetaDeckFilterValues): boolean {
  return (
    isScopeCustomized(filters.scope) ||
    filters.events.length > 0 ||
    filters.legends.length > 0 ||
    filters.maxRank !== null ||
    filters.maxCost !== null ||
    filters.valueMin !== null ||
    filters.valueMax !== null
  );
}
