import type { Printing } from "@openrift/shared/types/catalog";

import type { PrintingSearchRow, SearchIndexRows } from "@/features/cards/lib/card-search-rows";
import { cardSearchRows, printingSearchRows } from "@/features/cards/lib/card-search-rows";

/** Rows for `useCardSearch`, one per printing. Stable while `printings` is. */
export function usePrintingSearchIndex(
  printings: readonly Printing[],
): SearchIndexRows<PrintingSearchRow> {
  "use memo";
  return printingSearchRows(printings);
}

/** Rows for `useCardSearch`, one per card. Stable while `printings` is. */
export function useCardSearchIndex(
  printings: Iterable<Printing>,
): SearchIndexRows<PrintingSearchRow> {
  "use memo";
  return cardSearchRows(printings);
}
