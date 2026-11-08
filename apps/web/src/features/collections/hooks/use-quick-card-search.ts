import type { Printing } from "@openrift/shared/types/catalog";
import { useQuery } from "@tanstack/react-query";

import { useCatalogSearchVocabulary } from "@/features/cards/hooks/use-catalog-search-vocabulary";
import { pricesQueryOptions } from "@/features/cards/lib/prices-queries";
import { useQuickAddSearch } from "@/features/collections/hooks/use-quick-add-search";
import type { QuickAddCardResult } from "@/features/collections/lib/quick-add-result";
import { isSyntaxQuery, quickSyntaxSearch } from "@/features/collections/lib/quick-syntax-search";
import { useEnumOrders } from "@/hooks/use-enums";
import { useKeywordReverseMap } from "@/hooks/use-keyword-reverse-map";
import { useDisplayStore } from "@/stores/display-store";

const DEFAULT_LIMIT = 8;

interface QuickCardSearchOptions {
  ownedCountByPrinting?: Record<string, number>;
  preferredLanguages?: readonly string[];
  limit?: number;
}

// A `= {}` default allocates per render and stops the compiler memoizing the catalog scan.
const NO_OPTIONS: QuickCardSearchOptions = {};

export interface QuickCardSearch {
  results: QuickAddCardResult[];
  syntax: { total: number; problems: string[] } | null;
}

export function useQuickCardSearch(
  query: string,
  printingsByCardId: Map<string, Printing[]>,
  options: QuickCardSearchOptions = NO_OPTIONS,
): QuickCardSearch {
  const { limit = DEFAULT_LIMIT, preferredLanguages, ownedCountByPrinting } = options;
  const syntax = query.trim() !== "" && isSyntaxQuery(query);
  const plain = useQuickAddSearch(syntax ? "" : query, printingsByCardId, options);
  const vocabulary = useCatalogSearchVocabulary();
  const keywordReverseMap = useKeywordReverseMap();
  const { orders } = useEnumOrders();
  const rarityOrder = orders.rarities;
  const favoriteMarketplace = useDisplayStore((state) => state.marketplaceOrder[0]);
  const { data: prices } = useQuery({ ...pricesQueryOptions, enabled: syntax });

  const found = syntax
    ? quickSyntaxSearch(query, printingsByCardId, {
        vocabulary,
        context: {
          keywordReverseMap,
          rarityOrder,
          priceLookup: prices,
          getPrice: prices
            ? (printing) => prices.get(printing.printingId, favoriteMarketplace)
            : undefined,
        },
        preferredLanguages,
        ownedCountByPrinting,
        limit,
      })
    : null;
  return found
    ? { results: found.results, syntax: { total: found.total, problems: found.problems } }
    : { results: plain, syntax: null };
}
