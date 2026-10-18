import { cardSearchAltNames, legendDisplayName } from "@openrift/shared/card-name";
import type { SearchablePrintingCodes } from "@openrift/shared/card-search";
import { sideKey } from "@openrift/shared/printing-side";
import type { Printing } from "@openrift/shared/types/catalog";

export interface PrintingSearchRow {
  id: string;
  slug: string;
  name: string;
  altNames: string[];
  printing: Printing;
}

export interface SearchIndexRows<TRow> {
  rows: TRow[];
  codesByRowId: Map<string, SearchablePrintingCodes[]>;
}

function codesOf(printing: Printing): SearchablePrintingCodes[] {
  return [{ shortCode: printing.shortCode, publicCode: printing.publicCode }];
}

function rowFor(printing: Printing, id: string, slug: string): PrintingSearchRow {
  return {
    id,
    slug,
    name: legendDisplayName(printing.card),
    // A typed or pasted name may use the printed (localized) spelling.
    altNames: cardSearchAltNames(printing.card, [printing.printedName]),
    printing,
  };
}

/** One row per printing side, keyed by its side key and findable by its own codes. */
export function printingSearchRows(
  printings: readonly Printing[],
): SearchIndexRows<PrintingSearchRow> {
  return {
    rows: printings.map((printing) => rowFor(printing, sideKey(printing), printing.shortCode)),
    codesByRowId: new Map(printings.map((printing) => [sideKey(printing), codesOf(printing)])),
  };
}

/** One row per card, keyed by card id, with the card's first printing standing in for it. */
export function cardSearchRows(printings: Iterable<Printing>): SearchIndexRows<PrintingSearchRow> {
  const rows: PrintingSearchRow[] = [];
  const codesByRowId = new Map<string, SearchablePrintingCodes[]>();
  for (const printing of printings) {
    if (codesByRowId.has(printing.cardId)) {
      continue;
    }
    rows.push(rowFor(printing, printing.cardId, printing.cardId));
    codesByRowId.set(printing.cardId, codesOf(printing));
  }
  return { rows, codesByRowId };
}
