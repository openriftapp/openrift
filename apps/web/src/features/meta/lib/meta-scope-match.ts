import type { MetaEventTier } from "@openrift/shared/types/enums";

import type {
  MetaEra,
  MetaScope,
  MetaScopeFacet,
  ScopeFacetDefaults,
} from "@/features/meta/lib/meta-scope";
import { resolveScopeRange, scopeFacetValues } from "@/features/meta/lib/meta-scope";
import { normalizeCountryCode } from "@/lib/country";

export interface ScopedEvent {
  eventDate: string;
  format: string;
  tier: MetaEventTier;
  country: string | null;
}

/**
 * An axis carries includes or excludes, never both. A null value fails every
 * include set and passes every exclude set.
 */
function axisMatches(
  value: string | null,
  included: readonly string[],
  excluded: readonly string[],
): boolean {
  if (included.length > 0) {
    return value !== null && included.includes(value);
  }
  if (excluded.length > 0) {
    return value === null || !excluded.includes(value);
  }
  return true;
}

function countryCodes(values: readonly string[]): string[] {
  return values
    .map((value) => normalizeCountryCode(value))
    .filter((code): code is string => code !== null);
}

/**
 * Do not move this beside `metaScopeSearchSchema`: `lib/country` builds an
 * `Intl.DisplayNames` at module scope, and the search schemas are imported by non-lazy route files that run on every page load.
 */
export function scopeMatches(
  event: ScopedEvent,
  scope: MetaScope,
  eras: readonly MetaEra[],
  defaults: ScopeFacetDefaults = {},
  skip?: MetaScopeFacet,
): boolean {
  const format = scopeFacetValues(scope, "formats", defaults);
  if (skip !== "formats" && !axisMatches(event.format, format.included, format.excluded)) {
    return false;
  }
  const tier = scopeFacetValues(scope, "tiers", defaults);
  if (skip !== "tiers" && !axisMatches(event.tier, tier.included, tier.excluded)) {
    return false;
  }
  const country = scopeFacetValues(scope, "countries", defaults);
  if (
    skip !== "countries" &&
    !axisMatches(
      normalizeCountryCode(event.country),
      countryCodes(country.included),
      countryCodes(country.excluded),
    )
  ) {
    return false;
  }
  // Date-only strings sort lexicographically, so plain comparison is enough.
  const range = resolveScopeRange(scope, eras);
  if (range.from !== undefined && event.eventDate < range.from) {
    return false;
  }
  return range.to === undefined || event.eventDate <= range.to;
}

export type ScopeFacetCounts = Record<MetaScopeFacet, Map<string, number>>;

/** Each facet value's count with every other narrowing applied and the facet's own picks lifted. */
export function scopeFacetCounts<T extends ScopedEvent>(
  events: readonly T[],
  scope: MetaScope,
  eras: readonly MetaEra[],
  defaults: ScopeFacetDefaults = {},
  keep: (event: T) => boolean = () => true,
): ScopeFacetCounts {
  const counts: ScopeFacetCounts = { formats: new Map(), tiers: new Map(), countries: new Map() };
  const bump = (map: Map<string, number>, key: string | null) => {
    if (key !== null) {
      map.set(key, (map.get(key) ?? 0) + 1);
    }
  };
  for (const event of events) {
    if (!keep(event)) {
      continue;
    }
    if (scopeMatches(event, scope, eras, defaults, "formats")) {
      bump(counts.formats, event.format);
    }
    if (scopeMatches(event, scope, eras, defaults, "tiers")) {
      bump(counts.tiers, event.tier);
    }
    if (scopeMatches(event, scope, eras, defaults, "countries")) {
      bump(counts.countries, normalizeCountryCode(event.country));
    }
  }
  return counts;
}

export type ScopeFacetPresence = Record<MetaScopeFacet, ReadonlySet<string>>;

/** Values the fetched events carry at all; a chip narrows its options to these. */
export function scopeFacetPresence(events: readonly ScopedEvent[]): ScopeFacetPresence {
  const formats = new Set<string>();
  const tiers = new Set<string>();
  const countries = new Set<string>();
  for (const event of events) {
    formats.add(event.format);
    tiers.add(event.tier);
    const country = normalizeCountryCode(event.country);
    if (country !== null) {
      countries.add(country);
    }
  }
  return { formats, tiers, countries };
}
