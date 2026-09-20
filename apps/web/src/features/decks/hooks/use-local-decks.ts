import { eq, useLiveQuery } from "@tanstack/react-db";

import type { LocalDeck } from "@/features/decks/lib/local-deck";
import { getLocalDecksCollection } from "@/features/decks/lib/local-decks-collection";

export function useLocalDecks(): LocalDeck[] {
  // A live query mounted during SSR reverts the subtree to client rendering.
  const { data } = useLiveQuery({
    query: (q) =>
      globalThis.window === undefined ? null : q.from({ deck: getLocalDecksCollection() }),
  });
  return data ?? [];
}

export function useLocalDeck(deckId: string): LocalDeck | undefined {
  const { data } = useLiveQuery({
    query: (q) =>
      globalThis.window === undefined
        ? null
        : q.from({ deck: getLocalDecksCollection() }).where(({ deck }) => eq(deck.id, deckId)),
  });
  return data?.[0];
}

export function useIsLocalDeck(deckId: string): boolean {
  return useLocalDeck(deckId) !== undefined;
}
