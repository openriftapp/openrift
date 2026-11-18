import { cheapestPriceByCard } from "@openrift/shared/card-price";
import type { MetaDeckCardsQuery } from "@openrift/shared/types/api/meta";
import { useQuery } from "@tanstack/react-query";

import { useCatalogOnDemand } from "@/features/cards/hooks/use-cards";
import { pricesQueryOptions } from "@/features/cards/lib/prices-queries";
import { useBuildableCount } from "@/features/meta/hooks/use-buildable-count";
import type { MetaDeckCost } from "@/features/meta/lib/meta-deck-collection";
import {
  decodeMetaDeckCardIndex,
  metaDeckCosts,
  ownedCountsByCardId,
} from "@/features/meta/lib/meta-deck-collection";
import { metaDeckCardsQueryOptions } from "@/features/meta/lib/meta-queries";
import { useEffectiveLanguageOrder } from "@/hooks/use-effective-language-order";
import { useDisplayStore } from "@/stores/display-store";

/**
 * Undefined until the deck cards, catalogue, prices and (with a collection) the copies
 * have landed; never suspends on them. Server-rendered callers pass `enabled: false` until
 * hydrated, so the server and the first client render both show no costs.
 */
export function useMetaDeckCosts(
  includeSideboard: boolean,
  options: {
    enabled: boolean;
    withCollection: boolean;
    decks?: MetaDeckCardsQuery;
    partialDeckIds?: ReadonlySet<string>;
  },
): ReadonlyMap<string, MetaDeckCost> | undefined {
  const { enabled } = options;
  const { data: index } = useQuery({ ...metaDeckCardsQueryOptions(options.decks), enabled });
  const { catalog } = useCatalogOnDemand(enabled);
  const { data: prices } = useQuery({ ...pricesQueryOptions, enabled });
  const marketplace = useDisplayStore((state) => state.marketplaceOrder[0]);
  const languageOrder = useEffectiveLanguageOrder();
  const { data: stock } = useBuildableCount(enabled && options.withCollection);

  if (
    !enabled ||
    index === undefined ||
    catalog === undefined ||
    prices === undefined ||
    (options.withCollection && stock === undefined)
  ) {
    return undefined;
  }
  const { printingsByCardId } = catalog;
  return metaDeckCosts(decodeMetaDeckCardIndex(index), {
    includeSideboard,
    prices: cheapestPriceByCard(printingsByCardId, prices, marketplace, languageOrder),
    ownedByCardId:
      stock === undefined ? undefined : ownedCountsByCardId(stock.buildable, printingsByCardId),
    lockedByCardId:
      stock === undefined ? undefined : ownedCountsByCardId(stock.locked, printingsByCardId),
    partialDeckIds: options.partialDeckIds,
  });
}
