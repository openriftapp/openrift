import type { DeckZone } from "@openrift/shared/types/enums";
import { create } from "zustand";

import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";

interface WorkbenchState {
  relaxed: boolean;
  removedZoneChips: ReadonlySet<string>;
  dismissedAdvance: DeckZone | null;
  replaceTarget: { cardId: string; preferredPrintingId: string | null } | null;
  pendingLegend: DeckBuilderCard | null;
  lastAdd: { cardName: string; zone: DeckZone } | null;
  collapsedZones: ReadonlySet<DeckZone>;
  setZoneCollapsed: (zone: DeckZone, collapsed: boolean) => void;
  announceAdd: (cardName: string, zone: DeckZone) => void;
  setPendingLegend: (card: DeckBuilderCard | null) => void;
  setRelaxed: (relaxed: boolean) => void;
  removeZoneChip: (zone: DeckZone, chipKey: string) => void;
  restoreZoneChips: (zone: DeckZone) => void;
  setDismissedAdvance: (zone: DeckZone | null) => void;
  setReplaceTarget: (target: { cardId: string; preferredPrintingId: string | null } | null) => void;
  reset: () => void;
}

export const useWorkbenchStore = create<WorkbenchState>()((set) => ({
  relaxed: false,
  removedZoneChips: new Set<string>(),
  dismissedAdvance: null,
  replaceTarget: null,
  pendingLegend: null,
  lastAdd: null,
  collapsedZones: new Set<DeckZone>(),
  setZoneCollapsed: (zone, collapsed) =>
    set((state) => {
      const next = new Set(state.collapsedZones);
      if (collapsed) {
        next.add(zone);
      } else {
        next.delete(zone);
      }
      return { collapsedZones: next };
    }),
  announceAdd: (cardName, zone) => set({ lastAdd: { cardName, zone } }),
  setPendingLegend: (card) => set({ pendingLegend: card }),
  setRelaxed: (relaxed) => set({ relaxed }),
  removeZoneChip: (zone, chipKey) =>
    set((state) => ({
      removedZoneChips: new Set([...state.removedZoneChips, `${zone}:${chipKey}`]),
    })),
  restoreZoneChips: (zone) =>
    set((state) => ({
      removedZoneChips: new Set(
        [...state.removedZoneChips].filter((key) => !key.startsWith(`${zone}:`)),
      ),
    })),
  setDismissedAdvance: (zone) => set({ dismissedAdvance: zone }),
  setReplaceTarget: (target) => set({ replaceTarget: target }),
  reset: () =>
    set({
      relaxed: false,
      removedZoneChips: new Set<string>(),
      dismissedAdvance: null,
      replaceTarget: null,
      pendingLegend: null,
      lastAdd: null,
      collapsedZones: new Set<DeckZone>(),
    }),
}));
