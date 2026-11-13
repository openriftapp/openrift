import { totalQuantity } from "@openrift/shared/deck-rules";
import type { DeckZone } from "@openrift/shared/types/enums";
import { WellKnown } from "@openrift/shared/well-known";

import type { CardStats } from "@/features/collections/lib/card-stats";
import { computeCardStats, DECK_SINGLETON_TYPES } from "@/features/collections/lib/card-stats";
import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import { useEnumOrders } from "@/hooks/use-enums";

export type {
  DomainCount,
  DomainCombo,
  EnergyCostCount,
  PowerCount,
  TypeCount,
} from "@/features/collections/lib/stat-types";

interface DeckStats extends CardStats {
  mainDeckCards: number;
}

const MAIN_ZONES = new Set<DeckZone>([WellKnown.deckZone.MAIN, WellKnown.deckZone.CHAMPION]);

export function useDeckStats(cards: DeckBuilderCard[]): DeckStats {
  const { orders } = useEnumOrders();
  const mainCards = cards.filter((card) => MAIN_ZONES.has(card.zone));
  return {
    ...computeCardStats(mainCards, orders, DECK_SINGLETON_TYPES),
    mainDeckCards: totalQuantity(mainCards),
  };
}
