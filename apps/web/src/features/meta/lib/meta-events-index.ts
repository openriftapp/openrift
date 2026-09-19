import type { MetaEventFacetsResponse } from "@openrift/shared/types/api/meta";

import type {
  MetaEventHoldings,
  MetaEventIndexSort,
  MetaEventIndexSortDirection,
} from "@/features/meta/lib/meta-events-search";
import type { MetaScope } from "@/features/meta/lib/meta-scope";
import type { ScopeFacetCounts, ScopeFacetPresence } from "@/features/meta/lib/meta-scope-match";
import { normalizeCountryCode } from "@/lib/country";

export function facetCountsFrom(facets: MetaEventFacetsResponse): ScopeFacetCounts {
  const toMap = (values: readonly { value: string; count: number }[]) =>
    new Map(values.map((entry) => [entry.value, entry.count]));
  const countries = new Map<string, number>();
  for (const entry of facets.countries) {
    const code = normalizeCountryCode(entry.value);
    if (code !== null) {
      countries.set(code, (countries.get(code) ?? 0) + entry.count);
    }
  }
  return {
    formats: toMap(facets.formats),
    tiers: toMap(facets.tiers),
    countries,
  };
}

export function facetPresenceFrom(facets: MetaEventFacetsResponse): ScopeFacetPresence {
  const toSet = (values: readonly { value: string }[]) =>
    new Set(values.map((entry) => entry.value));
  const countries = new Set<string>();
  for (const entry of facets.countries) {
    const code = normalizeCountryCode(entry.value);
    if (code !== null) {
      countries.add(code);
    }
  }
  return {
    formats: toSet(facets.formats),
    tiers: toSet(facets.tiers),
    countries,
  };
}

/** How many events each holdings choice would show, with everything else applied. */
export function holdingsCountsFrom(
  facets: MetaEventFacetsResponse,
): Map<MetaEventHoldings | "", number> {
  return new Map([
    ["", facets.holdings.all],
    ["decks", facets.holdings.decks],
    ["standings", facets.holdings.standings],
    ["upcoming", facets.holdings.upcoming],
    ["resultless", facets.holdings.resultless],
  ]);
}

/** The countries a chip offers: those the filtered events carry, plus the scope's own picks. */
export function metaEventCountries(
  offered: readonly string[],
  scope: Pick<MetaScope, "countries" | "countriesEx">,
): string[] {
  const codes = new Set<string>();
  for (const value of offered) {
    const code = normalizeCountryCode(value);
    if (code !== null) {
      codes.add(code.toUpperCase());
    }
  }
  for (const picked of [...(scope.countries ?? []), ...(scope.countriesEx ?? [])]) {
    const code = normalizeCountryCode(picked);
    if (code !== null) {
      codes.add(code.toUpperCase());
    }
  }
  return [...codes].sort((left, right) => left.localeCompare(right));
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
