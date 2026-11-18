import type { ListEntryDetailResponse } from "@openrift/shared/types/api/list";
import type { Printing } from "@openrift/shared/types/catalog";
import { createContext, useContext, useState } from "react";
import { useStore } from "zustand";
import type { StoreApi } from "zustand";
import { createStore } from "zustand/vanilla";

interface ListEntriesState {
  entryByItemId: Map<string, ListEntryDetailResponse>;
  entryByKey: Map<string, ListEntryDetailResponse>;
  // The printing each selectable entry shows in the grid. Selection-wide actions
  // run from the DnD layer, which has no access to the browser's items.
  printingByEntryId: Map<string, Printing>;
  setEntries: (
    entryByItemId: Map<string, ListEntryDetailResponse>,
    entryByKey: Map<string, ListEntryDetailResponse>,
    printingByEntryId: Map<string, Printing>,
  ) => void;
}

export type ListEntriesStore = StoreApi<ListEntriesState>;

/**
 * The open list's entries, shared between its grid cells and the collection layout's drag handlers.
 * Cells select their own entry, so an entry mutation only re-renders the cell whose entry changed.
 */
export function createListEntriesStore(): ListEntriesStore {
  return createStore<ListEntriesState>()((set) => ({
    entryByItemId: new Map(),
    entryByKey: new Map(),
    printingByEntryId: new Map(),
    setEntries: (entryByItemId, entryByKey, printingByEntryId) =>
      set({ entryByItemId, entryByKey, printingByEntryId }),
  }));
}

/** Creates the collection layout's store once and keeps it for the layout's lifetime. */
export function useOwnListEntriesStore(): ListEntriesStore {
  // oxlint-disable-next-line react/hook-use-state -- a stable per-layout store, never replaced
  const [store] = useState(createListEntriesStore);
  return store;
}

export const ListEntriesStoreContext = createContext<ListEntriesStore | null>(null);

export function useListEntriesStoreApi(): ListEntriesStore {
  const store = useContext(ListEntriesStoreContext);
  if (store === null) {
    throw new Error("useListEntriesStore needs a CollectionLayout");
  }
  return store;
}

export function useListEntriesStore<T>(selector: (state: ListEntriesState) => T): T {
  return useStore(useListEntriesStoreApi(), selector);
}
