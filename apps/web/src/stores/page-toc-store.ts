import { createContext, useContext } from "react";
import { useStore } from "zustand";
import type { StoreApi } from "zustand";
import { createStore } from "zustand/vanilla";

interface PageTocState {
  activeId: string | null;
  heldId: string | null;
  setActiveId: (id: string | null) => void;
  selectActiveId: (id: string, hold: boolean) => void;
  releaseHold: (id?: string) => void;
}

export type PageTocStore = StoreApi<PageTocState>;

export function createPageTocStore(): PageTocStore {
  return createStore<PageTocState>()((set) => ({
    activeId: null,
    heldId: null,
    setActiveId: (id) => {
      set((state) => (state.heldId !== null || state.activeId === id ? state : { activeId: id }));
    },
    selectActiveId: (id, hold) => {
      set({ activeId: id, heldId: hold ? id : null });
    },
    releaseHold: (id) => {
      set((state) =>
        state.heldId === null || (id !== undefined && state.heldId !== id)
          ? state
          : { heldId: null },
      );
    },
  }));
}

export const PageTocStoreContext = createContext<PageTocStore | null>(null);

export function usePageTocStore<T>(selector: (state: PageTocState) => T): T {
  const store = useContext(PageTocStoreContext);
  if (store === null) {
    throw new Error("usePageTocStore needs a PageTocProvider");
  }
  return useStore(store, selector);
}
