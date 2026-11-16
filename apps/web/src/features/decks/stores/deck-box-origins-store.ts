import { create } from "zustand";

type Origins = Readonly<Record<string, string>>;

const NO_ORIGINS: Origins = {};

/** Per deck: the collection each copy ticked into the box came from, keyed by copy id. */
interface DeckBoxOriginsState {
  byDeck: Readonly<Record<string, Origins>>;
  remember: (deckId: string, copyId: string, collectionId: string) => void;
  forget: (deckId: string, copyIds: readonly string[]) => void;
  clear: (deckId: string) => void;
}

export const useDeckBoxOriginsStore = create<DeckBoxOriginsState>()((set) => ({
  byDeck: {},
  remember: (deckId, copyId, collectionId) =>
    set((state) => ({
      byDeck: {
        ...state.byDeck,
        [deckId]: { ...(state.byDeck[deckId] ?? NO_ORIGINS), [copyId]: collectionId },
      },
    })),
  forget: (deckId, copyIds) =>
    set((state) => {
      const origins = state.byDeck[deckId];
      if (!origins || !copyIds.some((copyId) => copyId in origins)) {
        return state;
      }
      const remaining = Object.fromEntries(
        Object.entries(origins).filter(([copyId]) => !copyIds.includes(copyId)),
      );
      return { byDeck: { ...state.byDeck, [deckId]: remaining } };
    }),
  clear: (deckId) =>
    set((state) => {
      if (!(deckId in state.byDeck)) {
        return state;
      }
      const { [deckId]: _removed, ...rest } = state.byDeck;
      return { byDeck: rest };
    }),
}));

export function useDeckBoxOrigins(deckId: string): Origins {
  return useDeckBoxOriginsStore((state) => state.byDeck[deckId] ?? NO_ORIGINS);
}
