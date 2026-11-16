import { create } from "zustand";

interface InfractionsOpenState {
  openRules: ReadonlySet<string>;
  toggle: (ruleNumber: string) => void;
  openAll: (ruleNumbers: readonly string[]) => void;
  closeAll: () => void;
}

export const useInfractionsOpenStore = create<InfractionsOpenState>()((set) => ({
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
