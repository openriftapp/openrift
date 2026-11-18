import type { Marketplace } from "@openrift/shared/types/pricing";
import { useQuery } from "@tanstack/react-query";

import { useCardsOnDemand } from "@/features/cards/hooks/use-cards";
import { pricesQueryOptions } from "@/features/cards/lib/prices-queries";
import {
  countExcludedAsAvailable,
  useDeckBuildingCounts,
} from "@/features/collections/hooks/use-owned-count";
import { computeDeckOwnership } from "@/features/decks/hooks/use-deck-ownership";
import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import type { DeckOwnershipData } from "@/features/decks/lib/deck-ownership-types";
import { useIncomingTradeCounts } from "@/features/groups/hooks/use-card-trades";
import { useBorrowedCounts } from "@/features/groups/hooks/use-loans";
import { useEffectiveLanguageOrder } from "@/hooks/use-effective-language-order";
import { useDisplayStore } from "@/stores/display-store";

const NO_COPIES: Record<string, number> = {};

/**
 * Ownership and prices for a deck the viewer is looking at, not editing. Undefined until the
 * catalogue, the prices and (logged in) the copies have landed, and while disabled; never
 * suspends. Server-rendered callers pass `enabled: useHydrated()`.
 */
export function useViewerDeckOwnership(
  builderCards: DeckBuilderCard[],
  options: { enabled: boolean; isLoggedIn: boolean; marketplace: Marketplace },
): DeckOwnershipData | undefined {
  const { enabled, isLoggedIn, marketplace } = options;
  const withCopies = enabled && isLoggedIn;
  const catalog = useCardsOnDemand(enabled);
  const { data: prices } = useQuery({ ...pricesQueryOptions, enabled });
  const languageOrder = useEffectiveLanguageOrder();
  // No home-collection exemption: a shared deck's home collection is never in its payload.
  const { data: deckBuildingCounts } = useDeckBuildingCounts(withCopies);
  const countExcluded = useDisplayStore((state) => state.countExcludedCollections);
  const { data: borrowedCounts } = useBorrowedCounts(withCopies);
  const { data: incomingCounts } = useIncomingTradeCounts(withCopies);

  const counts =
    deckBuildingCounts && countExcluded
      ? countExcludedAsAvailable(deckBuildingCounts)
      : deckBuildingCounts;
  const available = isLoggedIn ? counts?.available : NO_COPIES;
  if (!enabled || catalog === undefined || prices === undefined || available === undefined) {
    return undefined;
  }
  return computeDeckOwnership(
    builderCards,
    catalog.allPrintings,
    available,
    marketplace,
    prices,
    languageOrder,
    counts?.locked,
    borrowedCounts,
    counts && {
      loaned: counts.lockedLoaned,
      reserved: counts.lockedReserved,
      excluded: counts.lockedExcluded,
    },
    incomingCounts,
  );
}
