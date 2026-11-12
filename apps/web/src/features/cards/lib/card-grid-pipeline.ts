import { filterCards } from "@openrift/shared/filters";
import type { CardSearchContext } from "@openrift/shared/filters-shared";
import { sortCards } from "@openrift/shared/filters-sort";
import { sortByPreference } from "@openrift/shared/search-query/evaluate";
import type { SearchOrder } from "@openrift/shared/search-query/keys";
import { parseSearchQuery } from "@openrift/shared/search-query/parse";
import type { PriceLookup } from "@openrift/shared/types/api/pricing";
import type { Printing } from "@openrift/shared/types/catalog";
import type { Marketplace } from "@openrift/shared/types/pricing";
import type { CardFilters, GroupByField, SortOption } from "@openrift/shared/types/search";

import type { PriceRange } from "@/features/cards/lib/card-price-sort";
import { buildSortCardsOptions, computePriceRanges } from "@/features/cards/lib/card-price-sort";
import { dedupeToCardsViewTiles } from "@/features/cards/lib/card-tiles";
import type { SearchAlternative } from "@/features/cards/lib/search-alternative";
import { findSearchAlternatives } from "@/features/cards/lib/search-alternative";
import type { OwnedBucket } from "@/features/cards/lib/search-schemas";
import {
  applyOwnedBucketFilter,
  applyOwnedCountFilter,
} from "@/features/collections/lib/owned-bucket";
import type { GroupInfo } from "@/lib/card-group-types";

export interface CardGridInput {
  allPrintings: Printing[];
  sets: GroupInfo[];
  filters: CardFilters;
  view: "cards" | "printings";
  groupBy: GroupByField;
  sortBy: SortOption | SearchOrder;
  sortDir: "asc" | "desc";
  context: CardSearchContext;
  prices: PriceLookup;
  favoriteMarketplace: Marketplace;
  ownedCountByPrinting?: Record<string, number>;
  ownedFilter?: readonly OwnedBucket[];
  ownedCountMin?: number | null;
  ownedCountMax?: number | null;
}

export interface CardGrid {
  filteredCards: Printing[];
  displayCards: Printing[];
  sortedCards: Printing[];
  printingsByCardId: Map<string, Printing[]>;
  priceRangeByCardId: Map<string, PriceRange> | null;
  searchAlternatives: SearchAlternative[];
}

/** `allPrintings` must arrive sorted (userLanguageRank, canonicalRank): the dedupe keeps the first printing per tile. */
export function deriveCardGrid(input: CardGridInput): CardGrid {
  const { allPrintings, filters, view, groupBy, context, prices, favoriteMarketplace } = input;
  const { ownedCountByPrinting, ownedFilter, ownedCountMin, ownedCountMax } = input;
  const getPrice = (printing: Printing) => prices.get(printing.printingId, favoriteMarketplace);

  const matchPrintings = (search: string): Printing[] => {
    let matched = filterCards(allPrintings, { ...filters, search }, context);
    if (ownedCountByPrinting) {
      const bucketBy = view === "printings" ? "printing" : "card";
      if (ownedFilter && ownedFilter.length > 0) {
        matched = applyOwnedBucketFilter(matched, ownedFilter, ownedCountByPrinting, bucketBy);
      }
      if ((ownedCountMin ?? null) !== null || (ownedCountMax ?? null) !== null) {
        matched = applyOwnedCountFilter(
          matched,
          ownedCountMin ?? null,
          ownedCountMax ?? null,
          ownedCountByPrinting,
          bucketBy,
        );
      }
    }
    return matched;
  };
  const filteredCards = matchPrintings(filters.search);
  const searchAlternatives = findSearchAlternatives(filters.search, filteredCards, matchPrintings);

  const prefer = parseSearchQuery(filters.search).directives.prefer;
  const displayCards =
    view === "cards"
      ? dedupeToCardsViewTiles(
          prefer ? sortByPreference(filteredCards, prefer, prices) : filteredCards,
          groupBy,
        )
      : filteredCards;

  const printingsByCardId = Map.groupBy(filteredCards, (printing) => printing.cardId);
  const priceRangeByCardId =
    view === "cards" ? computePriceRanges(printingsByCardId, prices, favoriteMarketplace) : null;

  const sortOptions = buildSortCardsOptions({
    sortBy: input.sortBy,
    sortDir: input.sortDir,
    sets: input.sets,
    getPrice,
    rarityOrder: context.rarityOrder,
    prices,
    priceRangeByCardId,
  });
  const sortedCards = sortCards(displayCards, input.sortBy, sortOptions);

  return {
    filteredCards,
    displayCards,
    sortedCards,
    printingsByCardId,
    priceRangeByCardId,
    searchAlternatives,
  };
}
