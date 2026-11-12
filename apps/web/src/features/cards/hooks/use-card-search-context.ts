import type { CardSearchContext } from "@openrift/shared/filters-shared";
import { cardSearchContext } from "@openrift/shared/filters-shared";
import type { SearchContext } from "@openrift/shared/search-query/evaluate";

import { useCatalogSearchVocabulary } from "@/features/cards/hooks/use-catalog-search-vocabulary";
import { useEnumOrders } from "@/hooks/use-enums";
import { useKeywordReverseMap } from "@/hooks/use-keyword-reverse-map";

type ViewerParts = Pick<
  SearchContext,
  "getPrice" | "priceLookup" | "getOwnedCount" | "strict" | "customTagAssignments"
>;

const NO_VIEWER_PARTS: ViewerParts = {};

export function useCardSearchContext(viewer: ViewerParts = NO_VIEWER_PARTS): CardSearchContext {
  "use memo";
  const vocabulary = useCatalogSearchVocabulary();
  const keywordReverseMap = useKeywordReverseMap();
  const { orders } = useEnumOrders();
  return cardSearchContext({
    vocabulary,
    keywordReverseMap,
    rarityOrder: orders.rarities,
    ...viewer,
    customTagAssignments: viewer.customTagAssignments,
  });
}
