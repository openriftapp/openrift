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
  return useCatalogQuery(enabled, false);
}

/**
 * {@link useCards} without suspending: the page's `CatalogSubsetContext` slice, else the catalogue
 * once fetched. Undefined while disabled, so server-rendered callers pass `useHydrated()`.
 */
export function useCardsOnDemand(enabled: boolean): UseCardsResult | undefined {
  const subset = use(CatalogSubsetContext);
  const inLanguageOrder = use(CatalogLanguageOrderContext);
  const { catalog } = useCatalogOnDemand(enabled && subset === null);
  if (!enabled) {
    return undefined;
  }
  return subset === null ? catalog : inLanguageOrder(subset);
}

/** {@link useCatalogOnDemand} for a page that cannot render without the catalogue: a failed first load throws. */
export function useCatalogWhenReady(enabled: boolean): UseCardsResult | undefined {
  return useCatalogQuery(enabled, true).catalog;
}

function useCatalogQuery(enabled: boolean, throwWithoutData: boolean) {
  const languages = use(CatalogLanguagesContext);
  const { data, error } = useQuery({
    ...catalogQueryOptionsFor(languages),
    enabled,
    throwOnError: (_error, query) => throwWithoutData && query.state.data === undefined,
  });
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

export type CatalogTailStatus = "complete" | "loading" | "failed";

interface CatalogTailState {
  status: CatalogTailStatus;
  retry: () => void;
}

function useCatalogTailQueries(): {
  partial: CatalogEntry | null | undefined;
  state: CatalogTailState;
} {
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

  if (!partial) {
    return { partial, state: { status: "complete", retry } };
  }
  return {
    partial,
    state: { status: tail.isError && !tail.isFetching ? "failed" : "loading", retry },
  };
}

/** {@link useCatalogTailStatus} without starting the download: the tail loads on idle unless a caller calls `retry`. */
export function useCatalogTailState(): CatalogTailState {
  return useCatalogTailQueries().state;
}

/** Starts the tail download on mount, so a surface that needs every language does not wait for idle. */
export function useCatalogTailStatus(): CatalogTailState {
  const { partial, state } = useCatalogTailQueries();

  useScopeEffect(partial, (entry) => {
    if (entry) {
      state.retry();
    }
  });

  return state;
}
