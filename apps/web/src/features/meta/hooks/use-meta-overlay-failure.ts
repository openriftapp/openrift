import type { MetaDeckCardsQuery } from "@openrift/shared/types/api/meta";
import { useQuery } from "@tanstack/react-query";
import { use } from "react";

import { CatalogLanguagesContext } from "@/features/cards/lib/catalog-languages-context";
import { catalogQueryOptionsFor } from "@/features/cards/lib/catalog-queries";
import { pricesQueryOptions } from "@/features/cards/lib/prices-queries";
import { metaDeckCardsQueryOptions } from "@/features/meta/lib/meta-queries";

interface ObservedQuery {
  data: unknown;
  isError: boolean;
  isFetching: boolean;
  refetch: () => Promise<unknown>;
}

const failedWithoutData = (query: ObservedQuery) =>
  query.isError && !query.isFetching && query.data === undefined;

/**
 * Whether the deck cards, catalogue or prices behind the meta overlays failed their first load.
 * Observes the queries the overlay hooks fetch without fetching them itself.
 */
export function useMetaOverlayFailure(
  decks: MetaDeckCardsQuery | undefined,
  options: { enabled: boolean; withPrices: boolean },
): { failed: boolean; retry: () => void } {
  const languages = use(CatalogLanguagesContext);
  const deckCards = useQuery({ ...metaDeckCardsQueryOptions(decks), enabled: false });
  const catalog = useQuery({ ...catalogQueryOptionsFor(languages), enabled: false });
  const prices = useQuery({ ...pricesQueryOptions, enabled: false });
  const observed: ObservedQuery[] = options.withPrices
    ? [deckCards, catalog, prices]
    : [deckCards, catalog];
  const failing = observed.filter((query) => failedWithoutData(query));
  const retry = () => {
    for (const query of failing) {
      void query.refetch();
    }
  };
  return { failed: options.enabled && failing.length > 0, retry };
}
