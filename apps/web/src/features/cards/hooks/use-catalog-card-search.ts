import { buildCardLookupIndex } from "@openrift/shared/card-lookup";
import type { Card } from "@openrift/shared/types/catalog";
import type { ReactNode } from "react";

import { useCardSearch } from "@/features/cards/hooks/use-card-search";
import { useCards } from "@/features/cards/hooks/use-cards";
import type { CardSearchResult } from "@/features/cards/lib/card-search-result";

/**
 * `filter` must be identity-stable (a module-level predicate) or the search
 * index rebuilds every render.
 */
export function useCatalogCardSearch(
  query: string,
  filter?: (card: Card) => boolean,
  renderLeading?: (cardId: string) => ReactNode,
  minQueryLength?: number,
): CardSearchResult[] {
  "use memo";
  const { cardsById, printingsByCardId } = useCards();

  const cards = Object.entries(cardsById)
    .filter(([, card]) => filter === undefined || filter(card))
    .map(([id, card]) => ({
      id,
      slug: card.slug,
      name: card.name,
      types: card.types,
      tags: card.tags,
    }));
  const index = buildCardLookupIndex(cards, [...printingsByCardId.values()].flat());

  const matches = useCardSearch(index, query, undefined, minQueryLength);

  return matches.map((card) => ({
    id: card.id,
    label: card.displayName,
    sublabel: card.slug,
    leading: renderLeading?.(card.id),
  }));
}
