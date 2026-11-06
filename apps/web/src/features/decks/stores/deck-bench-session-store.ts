import { create } from "zustand";

import type { BenchState } from "@/features/decks/lib/deck-bench-pool";
import type { PlanSwapDraft } from "@/features/decks/lib/deck-plan";

interface BenchSession {
  bench: BenchState | null;
  selected: ReadonlySet<string>;
  swaps: PlanSwapDraft[];
}

export const EMPTY_BENCH_SESSION: BenchSession = { bench: null, selected: new Set(), swaps: [] };

interface DeckBenchSessionState {
  byDeck: Record<string, BenchSession>;
  patch: (deckId: string, update: Partial<BenchSession>) => void;
  clear: (deckId: string) => void;
}

export const useDeckBenchSessionStore = create<DeckBenchSessionState>()((set) => ({
  byDeck: {},
  patch: (deckId, update) =>
    set((state) => ({
      byDeck: {
        ...state.byDeck,
        [deckId]: { ...(state.byDeck[deckId] ?? EMPTY_BENCH_SESSION), ...update },
      },
    })),
  clear: (deckId) =>
    set((state) => {
      if (!(deckId in state.byDeck)) {
        return state;
      }
      const { [deckId]: _removed, ...rest } = state.byDeck;
      return { byDeck: rest };
    }),
}));
