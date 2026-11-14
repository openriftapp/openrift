import { sideKey } from "@openrift/shared/printing-side";
import type { Printing } from "@openrift/shared/types/catalog";

import { useCards } from "@/features/cards/hooks/use-cards";
import { usePreferredPrinting } from "@/features/cards/hooks/use-preferred-printing";
import { useDeckTokens } from "@/features/decks/hooks/use-deck-tokens";
import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import { sortOverviewCards } from "@/features/decks/lib/deck-card-sort";
import { DECK_TILE_ZONE_ORDER } from "@/features/decks/lib/deck-overview-geometry";
import type { CardViewerItem } from "@/lib/card-viewer-types";

interface UseDeckItemsResult {
  items: CardViewerItem[];
  printingsByCardId: Map<string, Printing[]>;
}

/**
 * Each zone appearance gets its own item, keyed `${zone}:${printingId}`, so a
 * card in both main and sideboard anchors nav at the instance clicked; tokens carry no zone.
 */
export function useDeckItems(cards: DeckBuilderCard[]): UseDeckItemsResult {
  "use memo";
  const { printingsByCardId } = useCards();
  const { getPreferredPrinting } = usePreferredPrinting();
  const tokens = useDeckTokens(cards);

  const items: CardViewerItem[] = [];
  for (const zone of DECK_TILE_ZONE_ORDER) {
    const inZone = cards.filter((card) => card.zone === zone);
    const sorted = sortOverviewCards(inZone, zone);
    for (const card of sorted) {
      const printing = getPreferredPrinting(card.cardId, card.preferredPrintingId);
      if (!printing) {
        continue;
      }
      items.push({ id: `${zone}:${sideKey(printing)}`, printing, zone });
    }
  }

  for (const token of tokens) {
    items.push({ id: `token:${sideKey(token.printing)}`, printing: token.printing });
  }

  return { items, printingsByCardId };
}
