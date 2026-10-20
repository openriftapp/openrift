import type { PackPrinting } from "@openrift/shared/pack-opener/types";
import { sideKey } from "@openrift/shared/printing-side";
import type { Printing } from "@openrift/shared/types/catalog";

export function toPackPrinting(p: Printing): PackPrinting {
  return {
    id: sideKey(p),
    printingId: p.printingId,
    cardId: p.cardId,
    cardName: p.card.name,
    cardSlug: p.card.slug,
    cardTypes: p.card.types,
    cardSuperTypes: p.card.superTypes,
    tags: p.card.tags,
    rarity: p.rarity,
    finish: p.finish,
    artVariant: p.artVariant,
    isSigned: p.isSigned,
    isOvernumbered: p.isOvernumbered,
    language: p.language,
    shortCode: p.shortCode,
    publicCode: p.publicCode,
    setSlug: p.setSlug,
  };
}

// "Other"-typed printings are buff-card backsides, not standalone pulls, and are excluded.
export function isBoosterEligible(printing: Printing): boolean {
  return printing.markers.length === 0 && !printing.card.types.includes("other");
}

/** One entry per physical printing, so a double-sided token is not pulled twice as often. */
export function boosterPrintings(printings: readonly Printing[], language: string): Printing[] {
  const seen = new Set<string>();
  return printings.filter((p) => {
    if (!isBoosterEligible(p) || p.language !== language || seen.has(p.printingId)) {
      return false;
    }
    seen.add(p.printingId);
    return true;
  });
}
