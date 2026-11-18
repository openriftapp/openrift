import { uniquePrintings } from "@openrift/shared/printing-side";
import type { Printing } from "@openrift/shared/types/catalog";

export interface VariantPopoverScope {
  cardId: string;
  setId?: string;
  printingId?: string;
}

/**
 * The catalog projection misses cards owned only in a filtered-out language; those fall
 * back to the language-scoped variant list.
 */
export function resolveVariantPopoverPrintings(
  catalogPrintingsByCardId: ReadonlyMap<string, Printing[]>,
  languageScopedPrintingsByCardId: ReadonlyMap<string, Printing[]>,
  popover: VariantPopoverScope | null,
): Printing[] | undefined {
  if (!popover) {
    return undefined;
  }
  const printings =
    catalogPrintingsByCardId.get(popover.cardId) ??
    languageScopedPrintingsByCardId.get(popover.cardId);
  const matching = printings?.filter((printing) => {
    if (popover.printingId) {
      return printing.printingId === popover.printingId;
    }
    return !popover.setId || printing.setId === popover.setId;
  });
  return matching === undefined ? undefined : uniquePrintings(matching);
}
