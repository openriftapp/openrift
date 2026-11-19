import { create } from "zustand";
import { persist } from "zustand/middleware";

import { mergeFields, pickEnum } from "@/lib/persist-merge";

export const TRADE_FINDER_VIEWS = ["person", "card"] as const;
export type TradeFinderView = (typeof TRADE_FINDER_VIEWS)[number];

export interface TradeFinderPick {
  direction: "incoming" | "outgoing";
  printingId: string;
  cardId: string;
}

interface TradeFinderState {
  view: TradeFinderView;
  openPersonId: string | null;
  picked: TradeFinderPick | null;
  setView: (view: TradeFinderView) => void;
  togglePerson: (userId: string) => void;
  pick: (picked: TradeFinderPick | null) => void;
}

export function isPicked(picked: TradeFinderPick | null, card: TradeFinderPick): boolean {
  return (
    picked !== null &&
    picked.direction === card.direction &&
    picked.printingId === card.printingId &&
    picked.cardId === card.cardId
  );
}

export const useTradeFinderStore = create<TradeFinderState>()(
  persist(
    (set) => ({
      view: "person",
      openPersonId: null,
      picked: null,
      setView: (view) => set({ view }),
      togglePerson: (userId) =>
        set((state) => ({ openPersonId: state.openPersonId === userId ? null : userId })),
      pick: (picked) => set({ picked }),
    }),
    {
      name: "openrift-trade-finder",
      partialize: (state) => ({ view: state.view }),
      merge: mergeFields<TradeFinderState>({ view: pickEnum(TRADE_FINDER_VIEWS) }),
    },
  ),
);
