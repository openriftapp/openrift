import { createContext, useContext } from "react";
import { useStore } from "zustand";
import type { StoreApi } from "zustand";
import { createStore } from "zustand/vanilla";

interface RulesPageState {
  folds: ReadonlyMap<string, string>;
  expandedExamples: ReadonlySet<string>;
  setFolded: (ruleNumber: string, folded: boolean, hash: string) => void;
  unfold: (ruleNumbers: readonly string[]) => void;
  toggleExamples: (ruleNumber: string) => void;
}

export type RulesPageStore = StoreApi<RulesPageState>;

export function createRulesPageStore(): RulesPageStore {
  return createStore<RulesPageState>()((set) => ({
    folds: new Map(),
    expandedExamples: new Set(),

    setFolded: (ruleNumber, folded, hash) =>
      set((state) => {
        const next = new Map(state.folds);
        if (folded) {
          next.set(ruleNumber, hash);
        } else {
          next.delete(ruleNumber);
        }
        return { folds: next };
      }),

    unfold: (ruleNumbers) =>
      set((state) => {
        if (!ruleNumbers.some((ruleNumber) => state.folds.has(ruleNumber))) {
          return state;
        }
        const next = new Map(state.folds);
        for (const ruleNumber of ruleNumbers) {
          next.delete(ruleNumber);
        }
        return { folds: next };
      }),

    toggleExamples: (ruleNumber) =>
      set((state) => {
        const next = new Set(state.expandedExamples);
        if (next.has(ruleNumber)) {
          next.delete(ruleNumber);
        } else {
          next.add(ruleNumber);
        }
        return { expandedExamples: next };
      }),
  }));
}

/** A fold made under the current hash holds even over a rule the hash reveals. */
export function isFoldShut(
  folds: ReadonlyMap<string, string>,
  ruleNumber: string,
  hash: string,
  revealed: ReadonlySet<string>,
): boolean {
  const foldedUnder = folds.get(ruleNumber);
  return foldedUnder !== undefined && (foldedUnder === hash || !revealed.has(ruleNumber));
}

export const RulesPageStoreContext = createContext<RulesPageStore | null>(null);

export function useRulesPageStore<T>(selector: (state: RulesPageState) => T): T {
  const store = useContext(RulesPageStoreContext);
  if (store === null) {
    throw new Error("useRulesPageStore needs a RulesPageStoreContext provider");
  }
  return useStore(store, selector);
}
