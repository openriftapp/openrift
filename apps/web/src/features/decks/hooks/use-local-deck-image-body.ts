import { useDeckCards } from "@/features/decks/hooks/use-deck-builder";
import { useIsLocalDeck, useLocalDeck } from "@/features/decks/hooks/use-local-decks";
import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import type { LocalDeckImageBody } from "@/features/decks/lib/local-deck-image-body";
import { buildLocalDeckImageBody } from "@/features/decks/lib/local-deck-image-body";
import { useSession } from "@/hooks/use-session";

/**
 * `cards` covers the deck-list menus, where the draft collection isn't
 * hydrated; otherwise the live editor draft is used.
 */
export function useLocalDeckImageBody(
  deckId: string,
  deckName: string | undefined,
  cards?: DeckBuilderCard[],
): () => LocalDeckImageBody {
  const { data: session } = useSession();
  // Only reads the live draft when needed; otherwise this would subscribe a
  // draft collection whose rows go unused, once per deck row in the list.
  const isLocal = useIsLocalDeck(deckId);
  const needsLiveCards = cards === undefined && isLocal;
  const liveCards = useDeckCards(needsLiveCards ? deckId : "");
  const format = useLocalDeck(deckId)?.format;

  return () => buildLocalDeckImageBody(deckName, format, session?.user?.name, cards ?? liveCards);
}
