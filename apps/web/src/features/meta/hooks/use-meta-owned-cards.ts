import { useCatalogOnDemand } from "@/features/cards/hooks/use-cards";
import { useBuildableCount } from "@/features/meta/hooks/use-buildable-count";

export interface MetaOwnedCards {
  ownedByPrinting: Readonly<Record<string, number>>;
  lockedByPrinting: Readonly<Record<string, number>>;
  printingsByCardId: ReadonlyMap<string, readonly { printingId: string }[]>;
}

/**
 * Undefined until the catalogue and the copies have landed; never suspends on them.
 * Server-rendered callers pass `enabled: false` until hydrated.
 */
export function useMetaOwnedCards(enabled: boolean): MetaOwnedCards | undefined {
  const { catalog } = useCatalogOnDemand(enabled);
  const { data: stock } = useBuildableCount(enabled);
  if (!enabled || catalog === undefined || stock === undefined) {
    return undefined;
  }
  return {
    ownedByPrinting: stock.buildable,
    lockedByPrinting: stock.locked,
    printingsByCardId: catalog.printingsByCardId,
  };
}
