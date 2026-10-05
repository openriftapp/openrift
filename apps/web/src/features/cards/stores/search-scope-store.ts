import type { SearchField } from "@openrift/shared/types/search";
import { ALL_SEARCH_FIELDS, DEFAULT_SEARCH_SCOPE } from "@openrift/shared/types/search";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { mergeFields, pickEnumArray } from "@/lib/persist-merge";

interface SearchScopeState {
  scope: SearchField[];
  toggleField: (field: SearchField) => void;
  selectAll: () => void;
  selectOnly: (field: SearchField) => void;
}

export const useSearchScopeStore = create<SearchScopeState>()(
  persist(
    (set) => ({
      scope: DEFAULT_SEARCH_SCOPE,
      toggleField: (field) =>
        set((state) => {
          const next = state.scope.includes(field)
            ? state.scope.filter((f) => f !== field)
            : [...state.scope, field];
          if (next.length === 0) {
            return state;
          }
          return { scope: next };
        }),
      selectAll: () => set({ scope: [...ALL_SEARCH_FIELDS] }),
      selectOnly: (field) => set({ scope: [field] }),
    }),
    {
      name: "openrift-search-scope",
      partialize: (state) => ({ scope: state.scope }),
      merge: mergeFields<SearchScopeState>({ scope: pickEnumArray(ALL_SEARCH_FIELDS) }),
    },
  ),
);
