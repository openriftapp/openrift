import { createContext, useContext, useState } from "react";
import { useStore } from "zustand";
import type { StoreApi } from "zustand";

import type { MultiSelectState } from "@/stores/multi-select-store";
import { createMultiSelectStore } from "@/stores/multi-select-store";

export type DeckSelectionStore = StoreApi<MultiSelectState>;

/** The deck list's multi-selection, shared between the page's selection bar and its rows and tiles. */
export function createDeckSelectionStore(): DeckSelectionStore {
  return createMultiSelectStore();
}

/** Creates the deck list page's store once and keeps it for the page's lifetime. */
export function useOwnDeckSelectionStore(): DeckSelectionStore {
  // oxlint-disable-next-line react/hook-use-state -- a stable per-page store, never replaced
  const [store] = useState(createDeckSelectionStore);
  return store;
}

export const DeckSelectionStoreContext = createContext<DeckSelectionStore | null>(null);

function useDeckSelectionStoreApi(): DeckSelectionStore {
  const store = useContext(DeckSelectionStoreContext);
  if (store === null) {
    throw new Error("useDeckSelectionStore needs a DeckListPage");
  }
  return store;
}

export function useDeckSelectionStore<T>(selector: (state: MultiSelectState) => T): T {
  return useStore(useDeckSelectionStoreApi(), selector);
}
