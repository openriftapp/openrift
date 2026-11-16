import type { LabelMap } from "@openrift/shared/enum-label";
import { enumLabel } from "@openrift/shared/enum-label";
import { WellKnown } from "@openrift/shared/well-known";

import { boosterOutcomeLabel } from "@/features/boosters/lib/booster-labels";
import type { PackPull } from "@/features/pack-opener/lib/pack-types";

/** Low to high. Token, Rune and Ultimate are outcome-derived keys, not rows in the `rarities` table. */
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

const OUTCOME_RARITY_KEYS: Record<string, string> = {
  rune: WellKnown.cardType.RUNE,
  "alt-art-rune": WellKnown.cardType.RUNE,
  token: WellKnown.superType.TOKEN,
  ultimate: WellKnown.artVariant.ULTIMATE,
};

/** The pull's rarity bucket: a rarity slug, or the outcome-derived rune, token and ultimate keys. */
export function packRarityKey(pull: PackPull): string {
  return OUTCOME_RARITY_KEYS[pull.outcome] ?? pull.printing.rarity;
}

const PACK_SLOT_COLORS: Record<string, string> = {
  [WellKnown.superType.TOKEN]: "#a8a29e",
  [WellKnown.cardType.RUNE]: "#6b7280",
  [WellKnown.artVariant.ULTIMATE]: "#d946ef",
};

export function packRarityColor(key: string, rarityColors: Record<string, string>): string {
  return rarityColors[key] ?? PACK_SLOT_COLORS[key] ?? "#888";
}

export function packRarityLabel(rarity: string, rarityLabels: LabelMap): string {
  switch (rarity) {
    case WellKnown.cardType.RUNE: {
      return boosterOutcomeLabel("rune");
    }
    case WellKnown.superType.TOKEN: {
      return boosterOutcomeLabel("token");
    }
    case WellKnown.artVariant.ULTIMATE: {
      return boosterOutcomeLabel("ultimate");
    }
    default: {
      return enumLabel(rarityLabels, rarity);
    }
  }
}

export const PREMIUM_OUTCOMES: ReadonlySet<string> = new Set([
  "signed-overnumbered",
  "overnumbered",
  "alt-art",
  "special-alt-art",
  "alt-art-rune",
]);

export function packPullLabel(pull: PackPull): string {
  return boosterOutcomeLabel(pull.outcome);
}
