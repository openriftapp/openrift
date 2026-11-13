import { legendDisplayName } from "@openrift/shared/card-name";
import type { CardType, DeckZone } from "@openrift/shared/types/enums";
import { WellKnown } from "@openrift/shared/well-known";

import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";

export const GROUPED_ZONES: ReadonlySet<DeckZone> = new Set([
  WellKnown.deckZone.MAIN,
  WellKnown.deckZone.SIDEBOARD,
  WellKnown.deckZone.OVERFLOW,
]);

export const TYPE_GROUP_ORDER: CardType[] = [
  WellKnown.cardType.UNIT,
  WellKnown.cardType.SPELL,
  WellKnown.cardType.GEAR,
];

/** Energy ascending → power ascending → card name alphabetical. */
export function compareDeckCardsByCurve(a: DeckBuilderCard, b: DeckBuilderCard): number {
  const energyDiff = (a.energy ?? 0) - (b.energy ?? 0);
  if (energyDiff !== 0) {
    return energyDiff;
  }
  const powerDiff = (a.power ?? 0) - (b.power ?? 0);
  if (powerDiff !== 0) {
    return powerDiff;
  }
  return legendDisplayName({ name: a.cardName, types: a.cardTypes, tags: a.tags }).localeCompare(
    legendDisplayName({ name: b.cardName, types: b.cardTypes, tags: b.tags }),
  );
}

function typeIndex(cardType: string): number {
  const index = TYPE_GROUP_ORDER.indexOf(cardType as CardType);
  return index === -1 ? TYPE_GROUP_ORDER.length : index;
}

export function compareGroupedCards(a: DeckBuilderCard, b: DeckBuilderCard): number {
  return typeIndex(a.cardType) - typeIndex(b.cardType) || compareDeckCardsByCurve(a, b);
}

/**
 * Non-grouped zones are returned as-is: the sidebar skips sorting them too,
 * so both surfaces keep the API-provided order (apps/api/src/repositories/decks.ts).
 */
export function sortOverviewCards(cards: DeckBuilderCard[], zone: DeckZone): DeckBuilderCard[] {
  return GROUPED_ZONES.has(zone) ? cards.toSorted(compareGroupedCards) : cards;
}

export function sortCardsLikeSidebar(
  cards: readonly DeckBuilderCard[],
  zoneOrder: readonly DeckZone[],
): DeckBuilderCard[] {
  const zoneIndex = new Map(zoneOrder.map((zone, index) => [zone, index]));
  const fallbackIndex = zoneOrder.length;
  const byZone = Map.groupBy(cards, (card) => card.zone);
  const orderedZones = [...byZone.keys()].toSorted(
    (a, b) => (zoneIndex.get(a) ?? fallbackIndex) - (zoneIndex.get(b) ?? fallbackIndex),
  );
  return orderedZones.flatMap((zone) => sortOverviewCards(byZone.get(zone) ?? [], zone));
}
