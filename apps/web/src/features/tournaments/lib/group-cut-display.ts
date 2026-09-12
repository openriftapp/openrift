import { CUT_SIZES, GROUP_STAGE_ROUNDS } from "@openrift/shared/pairing/group-cut-types";
import type { CutSize } from "@openrift/shared/pairing/group-cut-types";
import type { GroupCutTierView } from "@openrift/shared/types/api/pod-tournament";

import { m } from "@/paraglide/messages.js";

export function groupCutTierLabels(): Record<GroupCutTierView, string> {
  return {
    h2h: m.tournaments_lib_tier_h2h(),
    mini_table: m.tournaments_lib_tier_mini_table(),
    mw: m.tournaments_lib_tier_mw(),
    gw: m.tournaments_lib_tier_gw(),
    legend_count: m.tournaments_lib_tier_legend_count(),
    meta_share: m.tournaments_lib_tier_meta_share(),
    meta_pending: m.tournaments_lib_tier_meta_pending(),
    draw: m.tournaments_submit_draw(),
  };
}

export function cutSizeItems(): { value: string; label: string }[] {
  return CUT_SIZES.map((size) => ({
    value: String(size),
    label: m.tournaments_lib_cut_size_top({ size }),
  }));
}

export function parseCutSize(value: string): CutSize | null {
  const parsed = Number(value);
  return CUT_SIZES.find((size) => size === parsed) ?? null;
}

export interface GroupCountCheck {
  valid: boolean;
  message: string | null;
}

export function checkGroupPlayerCount(activeCount: number): GroupCountCheck {
  if (activeCount < 6) {
    return { valid: false, message: m.tournaments_lib_group_count_min() };
  }
  if (activeCount % 2 === 1) {
    return { valid: false, message: m.tournaments_lib_group_count_even() };
  }
  return { valid: true, message: null };
}

function cutRoundLongLabels(): string[] {
  return [
    m.tournaments_lib_cut_round_16(),
    m.tournaments_lib_cut_round_quarter(),
    m.tournaments_lib_cut_round_semi(),
    m.tournaments_lib_cut_round_final(),
  ];
}

function cutRoundShortLabelList(): string[] {
  return [
    m.tournaments_lib_cut_short_16(),
    m.tournaments_lib_cut_short_quarter(),
    m.tournaments_lib_cut_short_semi(),
    m.tournaments_lib_cut_round_final(),
  ];
}

/** Ordered from the first cut round to the final, sized for the cut. */
export function cutRoundLabels(cutSize: CutSize): string[] {
  const all = cutRoundLongLabels();
  return all.slice(all.length - Math.log2(cutSize));
}

function cutRoundShortLabels(cutSize: CutSize): string[] {
  const all = cutRoundShortLabelList();
  return all.slice(all.length - Math.log2(cutSize));
}

/** `roundNumber` is the tournament round; the group stage owns 1 to 3. */
export function cutRoundLabel(cutSize: CutSize, roundNumber: number): string {
  return (
    cutRoundLabels(cutSize)[roundNumber - GROUP_STAGE_ROUNDS - 1] ??
    m.tournaments_round_band_round({ number: roundNumber })
  );
}

export function cutRoundGenerateLabel(cutSize: CutSize, roundNumber: number): string {
  const all = [
    m.tournaments_cut_generate_round_16(),
    m.tournaments_cut_generate_quarter(),
    m.tournaments_cut_generate_semi(),
    m.tournaments_cut_generate_final(),
  ];
  return (
    all.slice(all.length - Math.log2(cutSize))[roundNumber - GROUP_STAGE_ROUNDS - 1] ??
    m.tournaments_cut_generate_round_number({ number: roundNumber })
  );
}

/** "QF 2", "Final": the name a later round's placeholder points back to. */
export function cutMatchShortLabel(
  cutSize: CutSize,
  roundNumber: number,
  podNumber: number,
): string {
  const labels = cutRoundShortLabels(cutSize);
  const index = roundNumber - GROUP_STAGE_ROUNDS - 1;
  const label = labels[index];
  if (label === undefined) {
    return m.tournaments_lib_pairing_label_match({ number: podNumber });
  }
  return index === labels.length - 1
    ? label
    : m.tournaments_lib_cut_match_short({ label, number: podNumber });
}

export function formatWinRate(rate: number | null): string {
  return rate === null ? "-" : `${Math.round(rate * 100)}%`;
}
