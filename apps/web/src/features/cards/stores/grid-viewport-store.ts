import { createContext, useContext } from "react";
import { useStore } from "zustand";
import type { StoreApi } from "zustand";
import { createStore } from "zustand/vanilla";

interface GridViewportState {
  autoColumns: number;
  setAutoColumns: (autoColumns: number) => void;
}

export type GridViewportStore = StoreApi<GridViewportState>;

/** The column count the grid measured for auto mode, shared with the toolbar's column controls. */
export function createGridViewportStore(): GridViewportStore {
  return createStore<GridViewportState>()((set) => ({
    autoColumns: 5,
    setAutoColumns: (autoColumns) =>
      set((state) => (state.autoColumns === autoColumns ? state : { autoColumns })),
  }));
}

export const GridViewportStoreContext = createContext<GridViewportStore | null>(null);

export function useGridViewportStore<T>(selector: (state: GridViewportState) => T): T {
  const store = useContext(GridViewportStoreContext);
  if (store === null) {
    throw new Error("useGridViewportStore needs a CardBrowserLayout");
  }
  return useStore(store, selector);
}
