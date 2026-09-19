import type { MetaDeckCardsQuery } from "@openrift/shared/types/api/meta";
import { useEffect } from "react";

import { useMetaDeckCosts } from "@/features/meta/hooks/use-meta-deck-costs";
import type { MetaDeckCost } from "@/features/meta/lib/meta-deck-collection";

/**
 * Client-only: the copies live query has no server snapshot, and the catalog
 * needed to match printings to cards is not otherwise loaded on this page.
 * Mount under `useHydrated` and a Suspense boundary.
 */
export function MetaDeckCostsBridge({
  includeSideboard,
  withCollection,
  decks,
  onChange,
}: {
  includeSideboard: boolean;
  withCollection: boolean;
  decks?: MetaDeckCardsQuery;
  onChange: (value: ReadonlyMap<string, MetaDeckCost> | undefined) => void;
}) {
  const costs = useMetaDeckCosts(includeSideboard, { withCollection, decks });
  useEffect(() => {
    onChange(costs);
  }, [costs, onChange]);
  return null;
}
