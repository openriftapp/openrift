import { legendDisplayName } from "@openrift/shared/card-name";
import type { Card } from "@openrift/shared/types/catalog";

import { useCards } from "@/features/cards/hooks/use-cards";

export interface CardPickerCandidate {
  cardId: string;
  cardName: string;
}

/**
 * `filter` must be identity-stable (a module-level predicate) or the candidate
 * list changes identity every render and `CardPicker` rebuilds its search index.
 */
export function useCardCandidates(filter?: (card: Card) => boolean): {
  candidates: CardPickerCandidate[];
  cardsById: Record<string, Card>;
} {
  const { cardsById } = useCards();
  const candidates = Object.entries(cardsById)
    .filter(([, card]) => filter === undefined || filter(card))
    .map(([cardId, card]) => ({ cardId, cardName: legendDisplayName(card) }));
  return { candidates, cardsById };
}
