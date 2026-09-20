import type { DeckFormat } from "@openrift/shared/types/enums";

import { useDeckCards } from "@/features/decks/hooks/use-deck-builder";
import { useIsLocalDeck, useLocalDeck } from "@/features/decks/hooks/use-local-decks";
import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import type { EncodeDeckCardInput } from "@/features/decks/lib/deck-encode-input";
import { toEncodeDeckCards } from "@/features/decks/lib/deck-encode-input";
import { useSession } from "@/lib/auth-session";

/**
 * Payload the from-cards deck-image renderer takes for a browser-local deck,
 * which has no server row to resolve by id.
 */
export interface LocalDeckImageBody {
  deckName: string;
  format: DeckFormat | undefined;
  ownerName: string;
  cards: EncodeDeckCardInput[];
}

export function buildLocalDeckImageBody(
  deckName: string | undefined,
  format: DeckFormat | undefined,
  ownerName: string | undefined,
  cards: DeckBuilderCard[],
): LocalDeckImageBody {
  return {
    deckName: deckName ?? "",
    format,
    ownerName: ownerName ?? "",
    cards: toEncodeDeckCards(cards),
  };
}

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
