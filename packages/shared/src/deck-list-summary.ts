import type { DeckCard } from "./deck-rules.js";
import { deckCardCount, validateDeck } from "./deck-rules.js";
import type { DeckListItemResponse } from "./types/api/deck.js";
import type { CardType, DeckFormat, Domain } from "./types/enums.js";
import { WellKnown } from "./well-known.js";

/**
 * Deliberately structural: the API passes DB rows, the web app passes
 * builder cards.
 */
export interface DeckCardSummaryInput {
  cardId: string;
  zone: string;
  quantity: number;
  cardTypes: readonly string[];
  domains: readonly string[];
}

export const EMPTY_DECK_LIST_SUMMARY: Omit<DeckListItemResponse, "deck"> = {
  legendCardId: null,
  championCardId: null,
  totalCards: 0,
  typeCounts: [],
  domainDistribution: [],
  isValid: false,
  requiredProgress: 0,
  requiredTotal: 0,
  totalValueCents: null,
  unpricedCardCount: null,
  missingCount: null,
  folderIds: [],
  familyName: null,
};

export interface DeckSummaryOrders {
  cardTypes: readonly string[];
  domains: readonly string[];
}

export interface DeckCardStats {
  legendCardId: string | null;
  championCardId: string | null;
  totalCards: number;
  typeCounts: { cardType: CardType; count: number }[];
  domainDistribution: { domain: Domain; count: number }[];
}

// Counts main + champion zones only; the three singleton types are excluded.
const EXCLUDED_TYPES = new Set<string>([
  WellKnown.cardType.LEGEND,
  WellKnown.cardType.RUNE,
  WellKnown.cardType.BATTLEFIELD,
]);
const COUNTED_ZONES = new Set<string>([WellKnown.deckZone.MAIN, WellKnown.deckZone.CHAMPION]);

export function summarizeDeckCards(
  cards: readonly DeckCardSummaryInput[],
  orders: DeckSummaryOrders,
): DeckCardStats {
  const typeCountMap = new Map<string, number>();
  const domainCountMap = new Map<string, number>();
  let legendCardId: string | null = null;
  let championCardId: string | null = null;

  for (const card of cards) {
    if (legendCardId === null && card.zone === WellKnown.deckZone.LEGEND) {
      legendCardId = card.cardId;
    }
    if (championCardId === null && card.zone === WellKnown.deckZone.CHAMPION) {
      championCardId = card.cardId;
    }
    if (!COUNTED_ZONES.has(card.zone)) {
      continue;
    }
    // A multi-type card counts under each of its non-excluded types.
    for (const cardType of card.cardTypes) {
      if (!EXCLUDED_TYPES.has(cardType)) {
        typeCountMap.set(cardType, (typeCountMap.get(cardType) ?? 0) + card.quantity);
      }
    }
    for (const domain of card.domains) {
      domainCountMap.set(domain, (domainCountMap.get(domain) ?? 0) + card.quantity);
    }
  }

  return {
    legendCardId,
    championCardId,
    totalCards: deckCardCount(cards),
    typeCounts: orders.cardTypes
      .filter((type) => typeCountMap.has(type))
      .map((type) => ({ cardType: type as CardType, count: typeCountMap.get(type) ?? 0 })),
    domainDistribution: orders.domains
      .filter((domain) => domainCountMap.has(domain))
      .map((domain) => ({ domain: domain as Domain, count: domainCountMap.get(domain) ?? 0 })),
  };
}

/**
 * Only Constructed is judged: the list query does not load per-card custom
 * tag assignments, and the tag-membership rule would mis-report without them.
 */
export function isValidInDeckList(format: string, cards: readonly DeckCard[]): boolean {
  if (format !== WellKnown.deckFormat.CONSTRUCTED) {
    return true;
  }
  return (
    validateDeck({
      format: WellKnown.deckFormat.CONSTRUCTED as DeckFormat,
      cards: [...cards],
    }).length === 0
  );
}
