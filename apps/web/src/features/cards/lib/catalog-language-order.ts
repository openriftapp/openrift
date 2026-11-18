import { sortByLanguageAndCanonicalRank } from "@openrift/shared/printing-select";
import { PREFERENCE_DEFAULTS } from "@openrift/shared/types/api/preferences";
import { createContext } from "react";

import type { UseCardsResult } from "@/features/cards/lib/catalog-queries";

export type CatalogLanguageOrder = (catalog: UseCardsResult) => UseCardsResult;

const orders = new WeakMap<readonly string[], CatalogLanguageOrder>();

/**
 * One order per language list, memoized per catalogue, so every component
 * under the same languages shares one sorted catalogue.
 */
export function catalogLanguageOrder(languages: readonly string[]): CatalogLanguageOrder {
  const existing = orders.get(languages);
  if (existing) {
    return existing;
  }
  const sortedByCatalog = new WeakMap<UseCardsResult, UseCardsResult>();
  const order: CatalogLanguageOrder = (catalog) => {
    if (languages.length === 0) {
      return catalog;
    }
    const cached = sortedByCatalog.get(catalog);
    if (cached) {
      return cached;
    }
    const allPrintings = sortByLanguageAndCanonicalRank(catalog.allPrintings, languages);
    const sorted = {
      ...catalog,
      allPrintings,
      printingsByCardId: Map.groupBy(allPrintings, (p) => p.cardId),
    };
    sortedByCatalog.set(catalog, sorted);
    return sorted;
  };
  orders.set(languages, order);
  return order;
}

/** The viewer's language order; the root provides it from the display languages. */
export const CatalogLanguageOrderContext = createContext<CatalogLanguageOrder>(
  catalogLanguageOrder(PREFERENCE_DEFAULTS.languages),
);
