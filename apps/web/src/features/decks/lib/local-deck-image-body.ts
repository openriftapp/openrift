import type { DeckFormat } from "@openrift/shared/types/enums";

import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import type { EncodeDeckCardInput } from "@/features/decks/lib/deck-encode-input";
import { toEncodeDeckCards } from "@/features/decks/lib/deck-encode-input";

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
