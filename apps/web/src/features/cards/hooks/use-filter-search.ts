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
