import { useCollectionsList } from "@/features/collections/hooks/use-collections";
import type { ResolvedTradeAddTarget } from "@/features/groups/lib/trade-add-target";
import { resolveTradeAddTarget } from "@/features/groups/lib/trade-add-target";
import { useTradeAddTargetStore } from "@/features/groups/stores/trade-add-target-store";

/**
 * Where the Trades page's one-press add files incoming copies: the collection
 * the viewer last picked, or the inbox until they pick one. A plain (non
 * suspense) collections query, so a row renders its label straight away and
 * corrects it once the collections arrive.
 * @returns The resolved target and its button label.
 */
export function useTradeAddTarget(): ResolvedTradeAddTarget {
  const remembered = useTradeAddTargetStore((state) => state.target);
  const collections = useCollectionsList();
  return resolveTradeAddTarget(remembered, collections);
}
