import { createContext, useContext } from "react";
import { useStore } from "zustand";
import type { StoreApi } from "zustand";
import { createStore } from "zustand/vanilla";

interface InfractionsOpenState {
  openRules: ReadonlySet<string>;
  toggle: (ruleNumber: string) => void;
  openAll: (ruleNumbers: readonly string[]) => void;
  closeAll: () => void;
}

export type InfractionsOpenStore = StoreApi<InfractionsOpenState>;

export function createInfractionsOpenStore(): InfractionsOpenStore {
  return createStore<InfractionsOpenState>()((set) => ({
    openRules: new Set(),

    toggle: (ruleNumber) =>
      set((state) => {
        const next = new Set(state.openRules);
        if (next.has(ruleNumber)) {
          next.delete(ruleNumber);
        } else {
          next.add(ruleNumber);
        }
        return { openRules: next };
      }),

    openAll: (ruleNumbers) =>
      set((state) => ({ openRules: new Set([...state.openRules, ...ruleNumbers]) })),

    closeAll: () => set((state) => (state.openRules.size === 0 ? state : { openRules: new Set() })),
  }));
}

export const InfractionsOpenStoreContext = createContext<InfractionsOpenStore | null>(null);

export function useInfractionsOpenStore<T>(selector: (state: InfractionsOpenState) => T): T {
  const store = useContext(InfractionsOpenStoreContext);
  if (store === null) {
    throw new Error("useInfractionsOpenStore needs an InfractionsOpenStoreContext provider");
  }
  return useStore(store, selector);
}
