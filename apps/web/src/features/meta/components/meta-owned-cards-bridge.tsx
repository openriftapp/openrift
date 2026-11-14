import { useEffect } from "react";

import { useCards } from "@/features/cards/hooks/use-cards";
import { useBuildableCount } from "@/features/meta/hooks/use-buildable-count";

export interface MetaOwnedCards {
  ownedByPrinting: Readonly<Record<string, number>>;
  lockedByPrinting: Readonly<Record<string, number>>;
  printingsByCardId: ReadonlyMap<string, readonly { printingId: string }[]>;
}

/**
 * Client-only for the same reasons as `MetaDeckCostsBridge`: the copies live
 * query has no server snapshot and the catalog is not otherwise loaded here.
 * Mount under `useHydrated` and a Suspense boundary.
 */
export function MetaOwnedCardsBridge({
  onChange,
}: {
  onChange: (value: MetaOwnedCards | undefined) => void;
}) {
  const { printingsByCardId } = useCards();
  const { data: stock } = useBuildableCount(true);
  useEffect(() => {
    onChange(
      stock === undefined
        ? undefined
        : {
            ownedByPrinting: stock.buildable,
            lockedByPrinting: stock.locked,
            printingsByCardId,
          },
    );
  }, [stock, printingsByCardId, onChange]);
  return null;
}
