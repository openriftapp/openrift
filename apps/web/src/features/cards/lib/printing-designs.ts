import type { Printing } from "@openrift/shared/types/catalog";

export interface PrintingDesign<T = Printing> {
  key: string;
  lead: T;
  byLanguage: Map<string, T>;
}

interface DesignMember {
  language: string;
  setId: string;
  shortCode: string;
}

function designKey(printing: Printing): string {
  return [
    printing.setId,
    printing.shortCode,
    printing.finish,
    printing.artVariant,
    printing.size,
    printing.isSigned,
    printing.isOvernumbered,
    printing.markers.map((marker) => marker.id).toSorted(),
    printing.otherSide?.cardId ?? "",
  ].join("|");
}

export function groupPrintingDesigns(printings: readonly Printing[]): {
  languages: string[];
  designs: PrintingDesign[];
} {
  return groupDesigns(printings, designKey);
}

/**
 * `printings` must be in language-preference order.
 * @returns The languages in order of appearance and the designs by set, then short code.
 */
export function groupDesigns<T extends DesignMember>(
  printings: readonly T[],
  keyOf: (printing: T) => string,
): {
  languages: string[];
  designs: PrintingDesign<T>[];
} {
  const languages = [...new Set(printings.map((printing) => printing.language))];
  const setRank = new Map<string, number>();
  const designs = new Map<string, PrintingDesign<T>>();

  for (const printing of printings) {
    if (!setRank.has(printing.setId)) {
      setRank.set(printing.setId, setRank.size);
    }
    const base = keyOf(printing);
    let key = base;
    for (let n = 1; designs.get(key)?.byLanguage.has(printing.language); n++) {
      key = `${base}#${n}`;
    }
    const design = designs.get(key);
    if (design) {
      design.byLanguage.set(printing.language, printing);
    } else {
      designs.set(key, {
        key,
        lead: printing,
        byLanguage: new Map([[printing.language, printing]]),
      });
    }
  }

  const ordered = [...designs.values()].toSorted(
    (a, b) =>
      (setRank.get(a.lead.setId) ?? 0) - (setRank.get(b.lead.setId) ?? 0) ||
      a.lead.shortCode.localeCompare(b.lead.shortCode, "en", { numeric: true }),
  );
  return { languages, designs: ordered };
}
