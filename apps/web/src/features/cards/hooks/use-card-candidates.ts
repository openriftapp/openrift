import type { Card } from "@openrift/shared/types/catalog";
import { legendDisplayName } from "@openrift/shared/utils";
import { useMemo } from "react";

import { useCards } from "@/features/cards/hooks/use-cards";

export interface CardCandidate {
  cardId: string;
  cardName: string;
}

/**
 * `filter` must be identity-stable (a module-level predicate) or the candidate
 * list changes identity every render and `CardPicker` rebuilds its search index.
 */
export function useCardCandidates(filter?: (card: Card) => boolean): {
  candidates: CardCandidate[];
  cardsById: Record<string, Card>;
} {
  const { cardsById } = useCards();
  const candidates = useMemo(
    () =>
      Object.entries(cardsById)
        .filter(([, card]) => filter === undefined || filter(card))
        .map(([cardId, card]) => ({ cardId, cardName: legendDisplayName(card) })),
    [cardsById, filter],
  );
  return { candidates, cardsById };
}
