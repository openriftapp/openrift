import { create } from "zustand";

import type { RuleExample } from "@/features/rules/lib/rule-examples";

interface RuleExamplesState {
  examplesByRule: Map<string, RuleExample[]>;
  expandedRules: Set<string>;
  setExamplesByRule: (examplesByRule: Map<string, RuleExample[]>) => void;
  toggle: (ruleNumber: string) => void;
}

export const useRuleExamplesStore = create<RuleExamplesState>()((set) => ({
  examplesByRule: new Map(),
  expandedRules: new Set(),

  setExamplesByRule: (examplesByRule) => {
    set({ examplesByRule, expandedRules: new Set() });
  },

  toggle: (ruleNumber) =>
    set((state) => {
      const next = new Set(state.expandedRules);
      if (next.has(ruleNumber)) {
        next.delete(ruleNumber);
      } else {
        next.add(ruleNumber);
      }
      return { expandedRules: next };
    }),
}));
