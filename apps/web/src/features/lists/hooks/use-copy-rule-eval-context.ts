import type { RuleEvalContext } from "@openrift/shared/list-rule-eval";

import { useCards } from "@/features/cards/hooks/use-cards";
import { useCatalogSearchVocabulary } from "@/features/cards/hooks/use-catalog-search-vocabulary";
import { usePrices } from "@/features/cards/hooks/use-prices";
import { useCopies } from "@/features/collections/hooks/use-copies";
import { useCustomTagAssignments } from "@/features/collections/hooks/use-custom-tag-assignments";
import { ownedCopiesFromCopyList } from "@/features/lists/lib/rule-owned-copies";
import { useEnumOrders } from "@/hooks/use-enums";
import { useKeywordReverseMap } from "@/hooks/use-keyword-reverse-map";

/** Personal copies only, like the server's `ownedRowsForUser`; undefined while copies load. */
export function useCopyRuleEvalContext(): RuleEvalContext | undefined {
  const { allPrintings, printingsById } = useCards();
  const customTagAssignments = useCustomTagAssignments();
  const { orders: enumOrders } = useEnumOrders();
  const priceLookup = usePrices();
  const vocabulary = useCatalogSearchVocabulary();
  const keywordReverseMap = useKeywordReverseMap();
  const copiesStore = useCopies();
  if (!copiesStore.isReady) {
    return undefined;
  }
  return {
    catalog: allPrintings,
    ownedCopies: ownedCopiesFromCopyList(copiesStore.data, printingsById),
    customTagAssignments,
    enumOrders,
    priceLookup,
    vocabulary,
    keywordReverseMap,
  };
}
