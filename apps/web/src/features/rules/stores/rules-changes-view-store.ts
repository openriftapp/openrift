import type { RuleKind } from "@openrift/shared/types/api/rules";
import { create } from "zustand";

export type RulesChangesView = "off" | "inline" | "side";

const VIEWS: readonly RulesChangesView[] = ["off", "inline", "side"];

export function isRulesChangesView(value: unknown): value is RulesChangesView {
  return VIEWS.includes(value as RulesChangesView);
}

interface RulesChangesViewState {
  byKind: Record<RuleKind, RulesChangesView>;
  setView: (kind: RuleKind, view: RulesChangesView) => void;
  reset: () => void;
}

const DEFAULTS: Record<RuleKind, RulesChangesView> = { core: "off", tournament: "off" };

export const useRulesChangesViewStore = create<RulesChangesViewState>()((set) => ({
  byKind: DEFAULTS,
  setView: (kind, view) => set((state) => ({ byKind: { ...state.byKind, [kind]: view } })),
  reset: () => set({ byKind: DEFAULTS }),
}));
