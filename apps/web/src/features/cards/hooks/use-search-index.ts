import type { CardSearchIndex } from "@openrift/shared/card-search";
import type { Printing } from "@openrift/shared/types/catalog";

import type { CardSearchRow, PrintingSearchRow } from "@/features/cards/lib/card-lookup-rows";
import { cardLookupIndex, printingLookupIndex } from "@/features/cards/lib/card-lookup-rows";

export function usePrintingSearchIndex(
  printings: readonly Printing[],
): CardSearchIndex<PrintingSearchRow> {
  "use memo";
  return printingLookupIndex(printings);
}

export function useCardSearchIndex(printings: Iterable<Printing>): CardSearchIndex<CardSearchRow> {
  "use memo";
  return cardLookupIndex(printings);
}
