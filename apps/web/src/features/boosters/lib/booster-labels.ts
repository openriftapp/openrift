import type { BoosterFrequency } from "@openrift/shared/boosters/odds";
import { packFrequency, unitFrequency } from "@openrift/shared/boosters/odds";
import type { BoosterBasis, BoosterBound } from "@openrift/shared/boosters/types";

import { formatCount } from "@/lib/format";
import { m } from "@/paraglide/messages.js";

const SLOT_LABELS: Record<string, () => string> = {
  common: m.booster_slot_common,
  uncommon: m.booster_slot_uncommon,
  foil: m.booster_slot_foil,
  rare: m.booster_slot_rare,
  rune: m.booster_slot_rune,
};

const OUTCOME_LABELS: Record<string, () => string> = {
  common: m.booster_outcome_common,
  uncommon: m.booster_outcome_uncommon,
  "foil-epic": m.booster_outcome_foil_epic,
  "foil-rare": m.booster_outcome_foil_rare,
  "foil-common-uncommon": m.booster_outcome_foil_common_uncommon,
  "signed-overnumbered": m.booster_outcome_signed_overnumbered,
  overnumbered: m.booster_outcome_overnumbered,
  "alt-art": m.booster_outcome_alt_art,
  "special-alt-art": m.booster_outcome_special_alt_art,
  epic: m.booster_outcome_epic,
  rare: m.booster_outcome_rare,
  ultimate: m.booster_outcome_ultimate,
  "alt-art-rune": m.booster_outcome_alt_art_rune,
  token: m.booster_outcome_token,
  rune: m.booster_outcome_rune,
};

const BASIS_LABELS: Record<BoosterBasis, () => string> = {
  official: m.booster_basis_official,
  estimate: m.booster_basis_estimate,
  guess: m.booster_basis_guess,
};

const BASIS_DESCRIPTIONS: Record<BoosterBasis, () => string> = {
  official: m.booster_basis_official_description,
  estimate: m.booster_basis_estimate_description,
  guess: m.booster_basis_guess_description,
};

export function boosterName(setName: string): string {
  return m.booster_name({ set: setName });
}

export function boosterSlotLabel(slug: string): string {
  return SLOT_LABELS[slug]?.() ?? slug;
}

export function boosterOutcomeLabel(slug: string): string {
  return OUTCOME_LABELS[slug]?.() ?? slug;
}

export function boosterBasisLabel(basis: BoosterBasis): string {
  return BASIS_LABELS[basis]();
}

export function boosterBasisDescription(basis: BoosterBasis): string {
  return BASIS_DESCRIPTIONS[basis]();
}

type Unit = "pack" | "box" | "case";

const UNIT_MESSAGES: Record<
  Unit,
  Record<BoosterFrequency["kind"], (n: { count: string }) => string>
> = {
  pack: { per: m.booster_rate_per_pack, "one-in": m.booster_rate_one_in_packs },
  box: { per: m.booster_rate_per_box, "one-in": m.booster_rate_one_in_boxes },
  case: { per: m.booster_rate_per_case, "one-in": m.booster_rate_one_in_cases },
};

function frequencyLabel(
  frequency: BoosterFrequency,
  unit: Unit,
  bound: BoosterBound | null,
): string {
  const rate = UNIT_MESSAGES[unit][frequency.kind]({ count: formatCount(frequency.count) });
  return bound === "max" ? m.booster_rate_at_most({ rate }) : rate;
}

export function perPackLabel(perPack: number, bound: BoosterBound | null = null): string {
  return frequencyLabel(packFrequency(perPack), "pack", bound);
}

export function perUnitLabel(
  perPack: number,
  packsPerUnit: number,
  unit: "box" | "case",
  bound: BoosterBound | null = null,
): string {
  return frequencyLabel(unitFrequency(perPack, packsPerUnit), unit, bound);
}
