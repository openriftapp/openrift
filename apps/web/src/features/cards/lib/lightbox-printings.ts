import { sideKey } from "@openrift/shared/printing-side";
import type { Printing } from "@openrift/shared/types/catalog";

import { groupPrintingDesigns } from "@/features/cards/lib/printing-designs";

export function withCatalogPrintings(
  printings: readonly Printing[],
  catalogPrintings: readonly Printing[],
): Printing[] {
  const known = new Set(printings.map((printing) => sideKey(printing)));
  return [...printings, ...catalogPrintings.filter((printing) => !known.has(sideKey(printing)))];
}

/**
 * `printings` must be in language-preference order.
 * @returns Every language's printing of each design when `language` is omitted.
 */
export function lightboxPrintingsInLanguage(
  printings: readonly Printing[],
  language?: string,
): Printing[] {
  return groupPrintingDesigns(printings).designs.flatMap((design) => {
    if (language === undefined) {
      return [...design.byLanguage.values()];
    }
    const member = design.byLanguage.get(language);
    return member ? [member] : [];
  });
}
