import { useQuery } from "@tanstack/react-query";
import { use } from "react";

import { CatalogLanguagesContext } from "@/features/cards/lib/catalog-languages-context";
import { catalogQueryOptionsFor } from "@/features/cards/lib/catalog-queries";
import { CatalogSubsetContext } from "@/features/cards/lib/catalog-subset-context";
import { pricesQueryOptions } from "@/features/cards/lib/prices-queries";

interface ObservedQuery {
  data: unknown;
  isError: boolean;
  isFetching: boolean;
  refetch: () => Promise<unknown>;
}

/**
 * Whether the catalogue or prices behind a viewed deck's ownership failed their first load.
 * Observes the queries `useViewerDeckOwnership` fetches without fetching them itself.
 */
export function useDeckOwnershipFailure(enabled: boolean): { failed: boolean; retry: () => void } {
  const languages = use(CatalogLanguagesContext);
  const subset = use(CatalogSubsetContext);
  const catalog = useQuery({ ...catalogQueryOptionsFor(languages), enabled: false });
  const prices = useQuery({ ...pricesQueryOptions, enabled: false });
  const observed: ObservedQuery[] = subset === null ? [catalog, prices] : [prices];
  const failing = observed.filter(
    (query) => query.isError && !query.isFetching && query.data === undefined,
  );
  const retry = () => {
    for (const query of failing) {
      void query.refetch();
    }
  };
  return { failed: enabled && failing.length > 0, retry };
}
