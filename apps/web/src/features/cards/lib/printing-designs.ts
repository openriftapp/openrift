import { sideKey } from "@openrift/shared/printing-side";
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
  otherSide?: { shortCode: string };
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

export function isSelfPaired(printing: Printing): boolean {
  return printing.otherSide?.cardId === printing.cardId;
}

function oneEntryPerSelfPairedPrinting(printings: readonly Printing[]): Printing[] {
  const kept = new Map<string, Printing>();
  for (const printing of printings) {
    if (!isSelfPaired(printing)) {
      continue;
    }
    const current = kept.get(printing.printingId);
    if (!current || (current.images.length === 0 && printing.images.length > 0)) {
      kept.set(printing.printingId, printing);
    }
  }
  return printings.filter(
    (printing) => !isSelfPaired(printing) || kept.get(printing.printingId) === printing,
  );
}

export function otherSideOf<T extends Pick<Printing, "printingId" | "side">>(
  printing: T,
  candidates: readonly T[],
): T | undefined {
  return candidates.find(
    (candidate) => candidate.printingId === printing.printingId && candidate.side !== printing.side,
  );
}

/** The card page's `?side=` for the other side: only a card on both sides needs one. */
export function otherSideSearchSide(printing: Printing): 2 | undefined {
  return isSelfPaired(printing) && printing.side === 1 ? 2 : undefined;
}

export function isSelectedSide(printing: Printing, selectedSideKey: string): boolean {
  if (isSelfPaired(printing)) {
    return (
      selectedSideKey === printing.printingId || selectedSideKey === `${printing.printingId}:2`
    );
  }
  return sideKey(printing) === selectedSideKey;
}

export function groupPrintingDesigns(printings: readonly Printing[]): {
  languages: string[];
  designs: PrintingDesign[];
} {
  return groupDesigns(oneEntryPerSelfPairedPrinting(printings), designKey);
}

/**
 * `printings` must be in language-preference order.
 * @returns The languages in order of appearance and the designs by set, then short code, then the other side's short code.
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
      a.lead.shortCode.localeCompare(b.lead.shortCode, "en", { numeric: true }) ||
      (a.lead.otherSide?.shortCode ?? "").localeCompare(b.lead.otherSide?.shortCode ?? "", "en", {
        numeric: true,
      }),
  );
  return { languages, designs: ordered };
}

export function sortByLanguagePreference(
  printings: readonly Printing[],
  languageOrder: readonly string[],
): Printing[] {
  const rankByLanguage = new Map(languageOrder.map((language, index) => [language, index]));
  const unlisted = languageOrder.length;
  return printings.toSorted(
    (a, b) =>
      (rankByLanguage.get(a.language) ?? unlisted) - (rankByLanguage.get(b.language) ?? unlisted) ||
      a.canonicalRank - b.canonicalRank,
  );
}
