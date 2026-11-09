import type { DeckResponse } from "@openrift/shared/types/api/deck";
import type { Printing } from "@openrift/shared/types/catalog";

import { Badge } from "@/components/ui/badge";
import type { CardDetailDeckBuilding } from "@/features/cards/components/card-detail/card-detail";
import { useCards } from "@/features/cards/hooks/use-cards";
import { usePreferredPrinting } from "@/features/cards/hooks/use-preferred-printing";
import type { DeckBuildingCounts } from "@/features/collections/hooks/use-owned-count";
import {
  DeckCardCopies,
  DeckCardDetailHeader,
  DeckRowNote,
} from "@/features/decks/components/deck-card-detail-controls";
import { useDeckCards } from "@/features/decks/hooks/use-deck-builder";
import { deckPrintingStock, planDeckCardDetail } from "@/features/decks/lib/deck-card-detail-plan";
import type { DeckOwnershipData } from "@/features/decks/lib/deck-ownership-types";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { useDisplayStore } from "@/stores/display-store";
import { useSelectionStore } from "@/stores/selection-store";

const NO_PRINTINGS: Printing[] = [];

export function useViewDeckCardDetail({
  deck,
  deckCounts,
  ownershipData,
}: {
  deck: Pick<DeckResponse, "id" | "format" | "formatConfig" | "collectionId">;
  deckCounts: DeckBuildingCounts | undefined;
  ownershipData: DeckOwnershipData | undefined;
}): (printing: Printing) => CardDetailDeckBuilding | undefined {
  const deckCards = useDeckCards(deck.id);
  const { printingsByCardId } = useCards();
  const { getPreferredPrinting } = usePreferredPrinting();
  const selectedZone = useSelectionStore((state) => state.selectedZone);
  const countExcluded = useDisplayStore((state) => state.countExcludedCollections);
  const stock = deckCounts && deckPrintingStock(deckCounts, countExcluded);

  return (printing) => {
    const cardId = printing.cardId;
    const cardEntries = deckCards.filter((card) => card.cardId === cardId);
    const zone = selectedZone ?? cardEntries[0]?.zone;
    if (!zone) {
      return;
    }
    const catalogPrintings = printingsByCardId.get(cardId) ?? NO_PRINTINGS;
    const plan = planDeckCardDetail({
      cardEntries,
      activeZone: zone,
      detailZone: zone,
      zoneSwitchable: false,
      defaultPrintingId: getPreferredPrinting(cardId)?.printingId,
      rowPrintingIds: new Set(catalogPrintings.map((row) => row.printingId)),
      activeZoneFull: true,
      copyLimitReached: true,
      isFreeform: false,
      stock,
    });
    const zones = Map.groupBy(cardEntries, (entry) => entry.zone);
    return {
      header: (
        <DeckCardDetailHeader
          deckId={deck.id}
          format={deck.format}
          formatConfig={deck.formatConfig}
          cardId={cardId}
          zone={zone}
          zones={[...zones].map(([entryZone, entries]) => ({
            zone: entryZone,
            count: entries.reduce((sum, entry) => sum + entry.quantity, 0),
          }))}
          missing={ownershipData?.byCardZone.get(`${cardId}:${zone}`)?.shortfall ?? 0}
        />
      ),
      rowEnd: (row) => {
        const { copies, isDefault } = plan.row(row.printingId);
        return (
          <>
            {isDefault && <Badge variant="neutral">{m.decks_editor_printing_default()}</Badge>}
            <span
              className={cn(
                "w-8 text-right text-sm font-medium tabular-nums",
                copies === 0 && "text-muted-foreground",
              )}
            >
              {copies}×
            </span>
          </>
        );
      },
      rowNote: (row) => <DeckRowNote uncovered={plan.row(row.printingId).uncovered} />,
      holdsCopies: (row) => plan.row(row.printingId).copies > 0,
      copies: <DeckCardCopies printings={catalogPrintings} homeCollectionId={deck.collectionId} />,
      hiddenAreOtherLanguages: true,
    };
  };
}
