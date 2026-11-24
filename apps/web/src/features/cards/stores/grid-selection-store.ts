import { createContext, useContext } from "react";
import { useStore } from "zustand";
import type { StoreApi } from "zustand";

import { useConstant } from "@/lib/use-constant";
import type { MultiSelectState } from "@/stores/multi-select-store";
import { createMultiSelectStore } from "@/stores/multi-select-store";

export type GridSelectionStore = StoreApi<MultiSelectState>;

/** The card grid's multi-selection, shared between its cells and the collection layout's drag handlers. */
export function createGridSelectionStore(): GridSelectionStore {
  return createMultiSelectStore();
}

/** Creates the collection layout's store once and keeps it for the layout's lifetime. */
export function useOwnGridSelectionStore(): GridSelectionStore {
  const store = useConstant(createGridSelectionStore);
  return store;
}

export const GridSelectionStoreContext = createContext<GridSelectionStore | null>(null);

export function useGridSelectionStoreApi(): GridSelectionStore {
  const store = useContext(GridSelectionStoreContext);
  if (store === null) {
    throw new Error("useGridSelectionStore needs a CollectionLayout");
  }
  return store;
}

export function useGridSelectionStore<T>(selector: (state: MultiSelectState) => T): T {
  return useStore(useGridSelectionStoreApi(), selector);
}
