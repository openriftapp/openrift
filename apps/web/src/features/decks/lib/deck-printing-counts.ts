import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";

type ZoneEntry = Pick<DeckBuilderCard, "preferredPrintingId" | "quantity">;

/** Unpinned copies follow the default printing, so they count on its row. */
export function printingCopiesInZone(
  entries: readonly ZoneEntry[],
  printingId: string,
  defaultPrintingId: string | undefined,
): number {
  let total = 0;
  for (const entry of entries) {
    const pinnedHere = entry.preferredPrintingId === printingId;
    const followsHere = entry.preferredPrintingId === null && printingId === defaultPrintingId;
    if (pinnedHere || followsHere) {
      total += entry.quantity;
    }
  }
  return total;
}

/** The entry a decrement on this row takes from; the default row gives up unpinned copies first. */
export function printingRemoveTarget(
  entries: readonly ZoneEntry[],
  printingId: string,
  defaultPrintingId: string | undefined,
): string | null | undefined {
  if (printingId === defaultPrintingId && entries.some((e) => e.preferredPrintingId === null)) {
    return null;
  }
  return entries.some((entry) => entry.preferredPrintingId === printingId) ? printingId : undefined;
}
