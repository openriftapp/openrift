import type { CompletionScopePreference } from "@openrift/shared/types/api/preferences";

import { useFilterValues } from "@/features/cards/hooks/use-card-filters";
import { scopeFromFilters } from "@/features/collections/lib/stats-scope";

// Every section left visible must stay mapped in STATS_SCOPE_FIELDS,
// or a chip the scope ignores looks live and does nothing.
export const HIDDEN_FILTER_SECTIONS = new Set([
  "owned",
  "noImage",
  "superTypes",
  "markers",
  "promo",
  "channels",
  "energy",
  "might",
  "power",
  "price",
]);

export function useScopeFromFilters(): CompletionScopePreference {
  const { filters } = useFilterValues();
  return scopeFromFilters(filters);
}
