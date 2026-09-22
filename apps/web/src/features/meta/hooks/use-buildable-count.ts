import {
  countExcludedAsAvailable,
  sumCounts,
  useDeckBuildingCounts,
} from "@/features/collections/hooks/use-owned-count";
import { useBorrowedCounts } from "@/features/groups/hooks/use-loans";
import { useDisplayStore } from "@/stores/display-store";

/** Same stock as a shared deck's page: loans and trade reservations drop out, borrowed copies count. */
export function useBuildableCount(enabled: boolean): {
  data: Record<string, number> | undefined;
} {
  const countExcluded = useDisplayStore((state) => state.countExcludedCollections);
  const { data: counts } = useDeckBuildingCounts(enabled);
  const { data: borrowed } = useBorrowedCounts(enabled);
  if (counts === undefined || borrowed === undefined) {
    return { data: undefined };
  }
  const stock = countExcluded ? countExcludedAsAvailable(counts) : counts;
  return { data: sumCounts(stock.available, borrowed) };
}
