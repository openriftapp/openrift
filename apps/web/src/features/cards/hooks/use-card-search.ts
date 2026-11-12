import { buildCardLookupIndex } from "@openrift/shared/card-lookup";
import type { CardSearchIndex, SearchableCard } from "@openrift/shared/card-search";
import {
  CARD_SEARCH_MIN_QUERY_LENGTH,
  CARD_SEARCH_RESULT_LIMIT,
  searchCards,
} from "@openrift/shared/card-search";

import type { CardSearchResult } from "@/features/cards/lib/card-search-result";

export function useCardSearch<TCard extends SearchableCard>(
  index: CardSearchIndex<TCard>,
  query: string,
  limit: number = CARD_SEARCH_RESULT_LIMIT,
  minQueryLength: number = CARD_SEARCH_MIN_QUERY_LENGTH,
): TCard[] {
  "use memo";
  if (query.length < minQueryLength) {
    return [];
  }
  return searchCards(index, query, limit);
}

function adminLookupIndex<TCard extends { id: string; slug: string; name: string }>(
  cards: readonly TCard[],
  shortCodesOf: (card: TCard) => readonly string[],
) {
  return buildCardLookupIndex(
    cards.map((card) => ({
      id: card.id,
      slug: card.slug,
      name: card.name,
      types: [],
      tags: [],
      source: card,
    })),
    cards.flatMap((card) =>
      shortCodesOf(card).map((code) => ({
        cardId: card.id,
        shortCode: code,
        publicCode: code,
        printedName: null,
      })),
    ),
  );
}

export interface AdminSearchableCard extends SearchableCard {
  types: string[];
  shortCodes: string[];
}

export function useAdminCardSearch(
  cards: readonly AdminSearchableCard[],
  query: string,
): CardSearchResult[] {
  "use memo";
  const index = adminLookupIndex(cards, (card) => card.shortCodes);
  return useCardSearch(index, query).map(({ source: card }) => ({
    id: card.id,
    label: card.name,
    sublabel: card.slug,
    detail: card.types.join(" "),
  }));
}

interface AssignableCard {
  cardId: string;
  cardSlug: string;
  cardName: string;
  setName: string;
  shortCodes: string[];
}

const ASSIGNABLE_RESULT_LIMIT = 10;

export function useAssignableCardSearch(
  cards: readonly AssignableCard[],
  query: string,
): CardSearchResult[] {
  "use memo";
  const index = adminLookupIndex(
    cards.map((card) => ({
      id: card.cardId,
      slug: card.cardSlug,
      name: card.cardName,
      setName: card.setName,
      shortCodes: card.shortCodes,
      firstShortCode: card.shortCodes.toSorted((a, b) => a.localeCompare(b))[0] ?? "",
    })),
    (card) => card.shortCodes,
  );
  return useCardSearch(index, query, ASSIGNABLE_RESULT_LIMIT).map(({ source: card }) => ({
    id: card.id,
    label: card.name,
    sublabel: card.firstShortCode,
    detail: card.setName,
  }));
}
