import { searchCards } from "@openrift/shared/card-search";
import { uniquePrintings } from "@openrift/shared/printing-side";
import { squashForSearch } from "@openrift/shared/search-fold";
import type { Printing } from "@openrift/shared/types/catalog";

import { cardLookupIndex } from "@/features/cards/lib/card-lookup-rows";
import type { QuickAddCardResult } from "@/features/collections/lib/quick-add-result";

interface QuickAddSearchOptions {
  ownedCountByPrinting?: Record<string, number>;
  preferredLanguages?: readonly string[];
  limit?: number;
}

const DEFAULT_LIMIT = 8;

function quickAddIndex(printingsByCardId: Map<string, Printing[]>) {
  return cardLookupIndex([...printingsByCardId.values()].flat());
}

function shownPrintings(printings: Printing[], languageKey: string): Printing[] {
  if (languageKey === "") {
    return printings;
  }
  const allowlist = new Set(languageKey.split(","));
  return printings.filter((printing) => allowlist.has(printing.language));
}

/**
 * Ranking uses the app-wide matcher (`@openrift/shared/card-search`), so
 * results order the same way here as in every other picker.
 */
export function useQuickAddSearch(
  query: string,
  printingsByCardId: Map<string, Printing[]>,
  options: QuickAddSearchOptions = {},
): QuickAddCardResult[] {
  "use memo";
  const { ownedCountByPrinting, preferredLanguages, limit = DEFAULT_LIMIT } = options;

  // Must be a joined string, not an array: a caller rebuilding the list each render
  // would otherwise invalidate the index on every keystroke.
  const languageKey = preferredLanguages?.join(",") ?? "";
  const index = quickAddIndex(printingsByCardId);

  if (query.trim() === "") {
    return [];
  }
  const typedCode = squashForSearch(query);
  return searchCards(index, query, limit).flatMap((row) => {
    const printings = shownPrintings(row.printings, languageKey);
    const first = printings[0];
    if (!first) {
      return [];
    }
    let ownedCount = 0;
    if (ownedCountByPrinting) {
      for (const printing of uniquePrintings(printings)) {
        ownedCount += ownedCountByPrinting[printing.printingId] ?? 0;
      }
    }
    const typed = printings.find(
      (printing) =>
        squashForSearch(printing.shortCode) === typedCode ||
        squashForSearch(printing.publicCode) === typedCode,
    );
    return [
      {
        cardId: row.id,
        cardName: row.displayName,
        defaultPrinting: typed ?? first,
        printings,
        ownedCount,
      },
    ];
  });
}
