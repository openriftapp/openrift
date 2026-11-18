import { useCardsOnDemand } from "@/features/cards/hooks/use-cards";
import { resolvePreferredPrinting } from "@/features/cards/hooks/use-preferred-printing";
import { useDeckBuildingCounts } from "@/features/collections/hooks/use-owned-count";
import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import type { OwnershipBandSources } from "@/features/decks/lib/deck-ownership-band";
import { collectOwnershipBandSources } from "@/features/decks/lib/deck-ownership-band";
import { useBorrowedCounts } from "@/features/groups/hooks/use-loans";
import { useEffectiveLanguageOrder } from "@/hooks/use-effective-language-order";

/**
 * The viewer's available copies and the catalogue printings behind the ownership bands.
 * Undefined until both have landed, and while disabled; never suspends. Copies in
 * excluded collections can't be sleeved, so only available counts feed the bands.
 */
export function useOwnershipBandSources(
  cards: readonly DeckBuilderCard[],
  options: { enabled: boolean; homeCollectionId?: string | null },
): OwnershipBandSources | undefined {
  const { enabled } = options;
  const catalog = useCardsOnDemand(enabled);
  const languageOrder = useEffectiveLanguageOrder();
  const { data: counts } = useDeckBuildingCounts(enabled, options.homeCollectionId);
  // Borrowed copies come from the loans feed, never from copy rows.
  const { data: borrowedCounts } = useBorrowedCounts(enabled);
  if (!enabled || catalog === undefined || counts === undefined) {
    return undefined;
  }
  const { printingsByCardId } = catalog;
  return collectOwnershipBandSources(
    cards,
    printingsByCardId,
    (cardId, preferredPrintingId) =>
      resolvePreferredPrinting(printingsByCardId, languageOrder, cardId, preferredPrintingId),
    counts.available,
    counts.locked,
    borrowedCounts,
  );
}
