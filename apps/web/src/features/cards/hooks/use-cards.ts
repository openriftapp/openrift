import { useQuery, useQueryClient, useSuspenseQueries } from "@tanstack/react-query";
import { use } from "react";

import { CatalogLanguageOrderContext } from "@/features/cards/lib/catalog-language-order";
import { CatalogLanguagesContext } from "@/features/cards/lib/catalog-languages-context";
import type { CatalogEntry, UseCardsResult } from "@/features/cards/lib/catalog-queries";
import {
  catalogQueryOptions,
  catalogQueryOptionsFor,
  catalogTailQueryOptions,
  ensureCatalogComplete,
} from "@/features/cards/lib/catalog-queries";
import { CatalogSubsetContext } from "@/features/cards/lib/catalog-subset-context";
import { useScopeEffect } from "@/hooks/use-scope-effect";

export function useCards(): UseCardsResult {
  return useCatalog(use(CatalogSubsetContext));
}

/** Fetches; mount behind `useHydrated()` inside a Suspense boundary. */
export function useFullCatalog(): UseCardsResult {
  return useCatalog(null);
}

function useCatalog(subset: UseCardsResult | null): UseCardsResult {
  const languages = use(CatalogLanguagesContext);
  const inLanguageOrder = use(CatalogLanguageOrderContext);
  // An empty query list neither fetches nor suspends, so a page that holds a subset never loads the catalogue.
  const queries: ReturnType<typeof catalogQueryOptionsFor>[] =
    subset === null ? [catalogQueryOptionsFor(languages)] : [];
  const fetched = useSuspenseQueries({ queries }).at(0)?.data;
  useCatalogTail(fetched ?? null);
  const catalog = subset ?? fetched;
  if (catalog === undefined) {
    throw new Error("The catalogue query resolved without data");
  }
  return inLanguageOrder(catalog);
}

export function useCatalogOnDemand(enabled: boolean): {
  catalog: UseCardsResult | undefined;
  error: Error | null;
} {
  const languages = use(CatalogLanguagesContext);
  const { data, error } = useQuery({ ...catalogQueryOptionsFor(languages), enabled });
  const inLanguageOrder = use(CatalogLanguageOrderContext);
  useCatalogTail(data ?? null);
  return { catalog: data && inLanguageOrder(data), error };
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
