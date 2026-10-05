import { enumLabel } from "@openrift/shared/enum-label";
import type { PackPull } from "@openrift/shared/pack-opener/types";
import { WellKnown } from "@openrift/shared/well-known";

import { m } from "@/paraglide/messages.js";

/** Low to high. Token, Rune and Ultimate are slot-derived keys, not rows in the `rarities` table. */
export const PACK_RARITY_ORDER: readonly string[] = [
  WellKnown.superType.TOKEN,
  WellKnown.rarity.COMMON,
  WellKnown.rarity.UNCOMMON,
  WellKnown.rarity.RARE,
  WellKnown.rarity.EPIC,
  WellKnown.rarity.SHOWCASE,
  WellKnown.cardType.RUNE,
  WellKnown.artVariant.ULTIMATE,
];

/** Sorts rarity keys high to low; a key outside the order sorts last. */
export function compareRarityDesc(left: string, right: string): number {
  return rarityRank(right) - rarityRank(left);
}

function rarityRank(rarity: string): number {
  return PACK_RARITY_ORDER.indexOf(rarity);
}

/** The pull's rarity bucket: a rarity slug, or the slot-derived rune, token and ultimate keys. */
export function packRarityKey(pull: PackPull): string {
  if (pull.slot === WellKnown.packSlot.TOKEN) {
    return pull.printing.cardSuperTypes.includes(WellKnown.superType.TOKEN)
      ? WellKnown.superType.TOKEN
      : WellKnown.cardType.RUNE;
  }
  if (pull.slot === WellKnown.packSlot.ULTIMATE) {
    return WellKnown.artVariant.ULTIMATE;
  }
  return pull.printing.rarity;
}

export function packRarityLabel(rarity: string, rarityLabels: Record<string, string>): string {
  switch (rarity) {
    case WellKnown.cardType.RUNE: {
      return m.packs_slot_rune();
    }
    case WellKnown.superType.TOKEN: {
      return m.packs_slot_token();
    }
    case WellKnown.artVariant.ULTIMATE: {
      return m.packs_slot_ultimate();
    }
    default: {
      return enumLabel(rarityLabels, rarity);
    }
  }
}

export function packSlotLabel(pull: PackPull, rarityLabels: Record<string, string>): string {
  const { printing } = pull;
  switch (pull.slot) {
    case WellKnown.packSlot.COMMON: {
      return enumLabel(rarityLabels, WellKnown.rarity.COMMON);
    }
    case WellKnown.packSlot.UNCOMMON: {
      return enumLabel(rarityLabels, WellKnown.rarity.UNCOMMON);
    }
    case WellKnown.packSlot.FLEX: {
      return enumLabel(rarityLabels, printing.rarity);
    }
    case WellKnown.packSlot.FOIL: {
      return m.packs_slot_foil({ rarity: enumLabel(rarityLabels, printing.rarity) });
    }
    case WellKnown.packSlot.TOKEN: {
      if (printing.cardSuperTypes.includes(WellKnown.superType.TOKEN)) {
        return m.packs_slot_token();
      }
      if (printing.finish === WellKnown.finish.FOIL) {
        return m.packs_slot_foil_rune();
      }
      if (printing.artVariant !== WellKnown.artVariant.NORMAL) {
        return m.packs_slot_alt_art_rune();
      }
      return m.packs_slot_rune();
    }
    case WellKnown.packSlot.SHOWCASE: {
      if (printing.isSigned) {
        return m.packs_slot_signed();
      }
      if (printing.isOvernumbered) {
        return m.packs_slot_overnumbered();
      }
      return m.packs_slot_alt_art();
    }
    case WellKnown.packSlot.ULTIMATE: {
      return m.packs_slot_ultimate();
    }
  }
}
