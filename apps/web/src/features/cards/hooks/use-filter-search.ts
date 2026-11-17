import { createContext, useContext } from "react";

import type { FilterSearch } from "@/features/cards/lib/search-schemas";

const FilterSearchContext = createContext<FilterSearch | null>(null);

export const FilterSearchProvider = FilterSearchContext;

export function useFilterSearch(): FilterSearch {
  const value = useContext(FilterSearchContext);
  if (value === null) {
    throw new Error("useFilterSearch must be used within a <FilterSearchProvider>");
  }
  return value;
}

/** The filter, search, sort and view state as a string; empty outside a filter surface. */
export function useFilterSearchKey(): string {
  const value = useContext(FilterSearchContext);
  return value === null ? "" : JSON.stringify(value);
}
