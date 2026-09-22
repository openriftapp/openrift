import type { MetaDeckCardsQuery } from "@openrift/shared/types/api/meta";

import { useCards } from "@/features/cards/hooks/use-cards";
import { usePrices } from "@/features/cards/hooks/use-prices";
import { useBuildableCount } from "@/features/meta/hooks/use-buildable-count";
import { useMetaDeckCards } from "@/features/meta/hooks/use-meta";
import type { MetaDeckCost } from "@/features/meta/lib/meta-deck-collection";
import {
  cheapestPriceByCardId,
  decodeMetaDeckCardIndex,
  metaDeckCosts,
  ownedCountsByCardId,
} from "@/features/meta/lib/meta-deck-collection";
import { useEffectiveLanguageOrder } from "@/hooks/use-effective-language-order";
import { useDisplayStore } from "@/stores/display-store";

/** Reads a live query, so it must sit under `useHydrated`. */
export function useMetaDeckCosts(
  includeSideboard: boolean,
  options: { withCollection: boolean; decks?: MetaDeckCardsQuery },
): ReadonlyMap<string, MetaDeckCost> | undefined {
  const { data: index } = useMetaDeckCards(options.decks);
  const { printingsByCardId } = useCards();
  const prices = usePrices();
  const marketplace = useDisplayStore((state) => state.marketplaceOrder[0]);
  const languageOrder = useEffectiveLanguageOrder();
  const { data: ownedByPrinting } = useBuildableCount(options.withCollection);

  if (options.withCollection && ownedByPrinting === undefined) {
    return undefined;
  }
  return metaDeckCosts(decodeMetaDeckCardIndex(index), {
    includeSideboard,
    prices: cheapestPriceByCardId(printingsByCardId, prices, marketplace, languageOrder),
    ownedByCardId:
      ownedByPrinting === undefined
        ? undefined
        : ownedCountsByCardId(ownedByPrinting, printingsByCardId),
  });
}
