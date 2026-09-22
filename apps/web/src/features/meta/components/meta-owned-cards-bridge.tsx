import { useEffect } from "react";

import { useCards } from "@/features/cards/hooks/use-cards";
import { useBuildableCount } from "@/features/meta/hooks/use-buildable-count";

export interface MetaOwnedCards {
  ownedByPrinting: Readonly<Record<string, number>>;
  printingsByCardId: ReadonlyMap<string, readonly { id: string }[]>;
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
  const { data: ownedByPrinting } = useBuildableCount(true);
  useEffect(() => {
    onChange(ownedByPrinting === undefined ? undefined : { ownedByPrinting, printingsByCardId });
  }, [ownedByPrinting, printingsByCardId, onChange]);
  return null;
}
