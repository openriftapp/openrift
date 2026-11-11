import { sortByLanguageAndCanonicalRank } from "@openrift/shared/printing-select";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { use } from "react";

import type { CatalogEntry, UseCardsResult } from "@/features/cards/lib/catalog-queries";
import {
  catalogQueryOptions,
  catalogTailQueryOptions,
  ensureCatalogComplete,
  noCatalogQueryOptions,
} from "@/features/cards/lib/catalog-queries";
import { CatalogSubsetContext } from "@/features/cards/lib/catalog-subset-context";
import { useScopeEffect } from "@/hooks/use-scope-effect";
import { useDisplayStore } from "@/stores/display-store";

export function useCards(): UseCardsResult {
  return useCatalog(use(CatalogSubsetContext));
}

/** Fetches; mount behind `useHydrated()` inside a Suspense boundary. */
export function useFullCatalog(): UseCardsResult {
  return useCatalog(null);
}

function useCatalog(subset: UseCardsResult | null): UseCardsResult {
  // `queryOptions` bakes each literal query key into its own option type, so
  // the stand-in is unrelated to the real one even though the call takes either.
  const options =
    subset === null
      ? catalogQueryOptions
      : (noCatalogQueryOptions as unknown as typeof catalogQueryOptions);

  // React Query's structural sharing can't preserve identity for a shape
  // containing a Map; `enrichCatalog` memoizes by input identity instead.
  const { data } = useSuspenseQuery(options);
  const userLanguages = useDisplayStore((state) => state.languages);
  useCatalogTail(subset === null ? data : null);
  return inLanguageOrder(subset ?? data, userLanguages);
}

export function useCatalogOnDemand(enabled: boolean): {
  catalog: UseCardsResult | undefined;
  error: Error | null;
} {
  const { data, error } = useQuery({ ...catalogQueryOptions, enabled });
  const userLanguages = useDisplayStore((state) => state.languages);
  useCatalogTail(data ?? null);
  return { catalog: data && inLanguageOrder(data, userLanguages), error };
}

function useCatalogTail(fetched: UseCardsResult | null): void {
  const queryClient = useQueryClient();

  // requestIdleCallback is missing on iOS Safari, hence the timeout fallback.
  useScopeEffect(fetched, (scope) => {
    if (scope === null) {
      return;
    }
    const start = () => void ensureCatalogComplete(queryClient);
    if (typeof requestIdleCallback === "function") {
      const handle = requestIdleCallback(start, { timeout: 5000 });
      return () => cancelIdleCallback(handle);
    }
    const timer = setTimeout(start, 1500);
    return () => clearTimeout(timer);
  });
}

type CatalogTailStatus = "complete" | "loading" | "failed";

export function useCatalogTailStatus(): { status: CatalogTailStatus; retry: () => void } {
  const queryClient = useQueryClient();
  const { data: partial } = useQuery({
    ...catalogQueryOptions,
    enabled: false,
    select: (entry: CatalogEntry) => (entry.partialLanguages === null ? null : entry),
  });
  const tail = useQuery({
    ...catalogTailQueryOptions(partial?.version ?? null, partial?.partialLanguages ?? []),
    enabled: false,
  });
  const retry = () => void ensureCatalogComplete(queryClient);

  useScopeEffect(partial, (entry) => {
    if (entry) {
      retry();
    }
  });

  if (!partial) {
    return { status: "complete", retry };
  }
  return { status: tail.isError && !tail.isFetching ? "failed" : "loading", retry };
}

function inLanguageOrder(
  catalog: UseCardsResult,
  userLanguages: readonly string[],
): UseCardsResult {
  if (userLanguages.length === 0) {
    return catalog;
  }
  const sortedPrintings = sortByLanguageAndCanonicalRank(catalog.allPrintings, userLanguages);
  return {
    ...catalog,
    allPrintings: sortedPrintings,
    printingsByCardId: Map.groupBy(sortedPrintings, (p) => p.cardId),
  };
}
