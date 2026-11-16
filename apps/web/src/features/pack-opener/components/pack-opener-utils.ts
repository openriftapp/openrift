import type { BoosterPack } from "@openrift/shared/boosters/sample";
import { sideKey } from "@openrift/shared/printing-side";
import type { Printing } from "@openrift/shared/types/catalog";

import type { PackPrinting, PackResult } from "@/features/pack-opener/lib/pack-types";

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

export function toPackResult(pack: BoosterPack): PackResult {
  return {
    pulls: pack.pulls.map((pull) => ({
      slot: pull.slot,
      outcome: pull.outcome,
      printing: toPackPrinting(pull.printing.printing),
    })),
  };
}
