import type { Printing } from "@openrift/shared/types/catalog";

export interface PrintingDesign {
  key: string;
  lead: Printing;
  byLanguage: Map<string, Printing>;
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

/**
 * `printings` must be in language-preference order.
 * @returns The languages in order of appearance and the designs by set, then short code.
 */
export function groupPrintingDesigns(printings: readonly Printing[]): {
  languages: string[];
  designs: PrintingDesign[];
} {
  const languages = [...new Set(printings.map((printing) => printing.language))];
  const setRank = new Map<string, number>();
  const designs = new Map<string, PrintingDesign>();

  for (const printing of printings) {
    if (!setRank.has(printing.setId)) {
      setRank.set(printing.setId, setRank.size);
    }
    const base = designKey(printing);
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
