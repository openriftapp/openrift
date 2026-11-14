import {
  countExcludedAsAvailable,
  sumCounts,
  useDeckBuildingCounts,
} from "@/features/collections/hooks/use-owned-count";
import { useBorrowedCounts } from "@/features/groups/hooks/use-loans";
import { useDisplayStore } from "@/stores/display-store";

export interface BuildableStock {
  buildable: Record<string, number>;
  locked: Record<string, number>;
}

/** Same stock as a shared deck's page: loans and trade reservations are locked, borrowed copies count. */
export function useBuildableCount(enabled: boolean): {
  data: BuildableStock | undefined;
} {
  const countExcluded = useDisplayStore((state) => state.countExcludedCollections);
  const { data: counts } = useDeckBuildingCounts(enabled);
  const { data: borrowed } = useBorrowedCounts(enabled);
  if (counts === undefined || borrowed === undefined) {
    return { data: undefined };
  }
  const stock = countExcluded ? countExcludedAsAvailable(counts) : counts;
  return { data: { buildable: sumCounts(stock.available, borrowed), locked: stock.locked } };
}
