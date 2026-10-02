import { create } from "zustand";

interface RulesFoldState {
  foldedRules: Set<string>;
  toggle: (ruleNumber: string) => void;
  expandAll: () => void;
}

export const useRulesFoldStore = create<RulesFoldState>()((set) => ({
  foldedRules: new Set(),

  toggle: (ruleNumber) =>
    set((state) => {
      const next = new Set(state.foldedRules);
      if (next.has(ruleNumber)) {
        next.delete(ruleNumber);
      } else {
        next.add(ruleNumber);
      }
      return { foldedRules: next };
    }),

  expandAll: () =>
    set((state) => {
      if (state.foldedRules.size === 0) {
        return state;
      }
      return { foldedRules: new Set() };
    }),
}));
