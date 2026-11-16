import { CUT_SIZES, GROUP_STAGE_ROUNDS } from "@openrift/shared/pairing/group-cut-types";
import type { CutSize } from "@openrift/shared/pairing/group-cut-types";
import { groupCountProblem } from "@openrift/shared/pairing/group-stage";
import type {
  GroupCutTierView,
  GroupQualificationRowView,
} from "@openrift/shared/types/api/pod-tournament";

import { participantName } from "@/features/tournaments/lib/participant-name";
import { bracketRoundLabels } from "@/lib/bracket-round-label";
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
  const problem = groupCountProblem(activeCount);
  if (problem === "too_few") {
    return { valid: false, message: m.tournaments_lib_group_count_min() };
  }
  if (problem === "odd") {
    return { valid: false, message: m.tournaments_lib_group_count_even() };
  }
  return { valid: true, message: null };
}

export function cutStageIndex(
  cutSize: CutSize,
  roundNumber: number,
  stageCount: number,
): number | null {
  const index = stageCount - Math.log2(cutSize) + roundNumber - GROUP_STAGE_ROUNDS - 1;
  return roundNumber > GROUP_STAGE_ROUNDS && index >= 0 && index < stageCount ? index : null;
}

/** Ordered from the first cut round to the final, sized for the cut. */
export function cutRoundLabels(cutSize: CutSize): string[] {
  return bracketRoundLabels(Math.log2(cutSize));
}

/** `roundNumber` is the tournament round; the group stage owns 1 to 3. */
export function cutRoundLabel(cutSize: CutSize, roundNumber: number): string {
  const labels = cutRoundLabels(cutSize);
  const index = cutStageIndex(cutSize, roundNumber, labels.length);
  return (
    (index === null ? undefined : labels[index]) ??
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
  const index = cutStageIndex(cutSize, roundNumber, all.length);
  return (
    (index === null ? undefined : all[index]) ??
    m.tournaments_cut_generate_round_number({ number: roundNumber })
  );
}

/** "QF 2", "Final": the name a later round's placeholder points back to. */
export function cutMatchShortLabel(
  cutSize: CutSize,
  roundNumber: number,
  podNumber: number,
): string {
  const labels = bracketRoundLabels(Math.log2(cutSize), true);
  const index = roundNumber - GROUP_STAGE_ROUNDS - 1;
  const label = labels[index];
  if (label === undefined) {
    return m.tournaments_lib_pairing_label_match({ number: podNumber });
  }
  return index === labels.length - 1
    ? label
    : m.tournaments_lib_cut_match_short({ label, number: podNumber });
}

const NO_STAT = "-";

export function formatWinRate(rate: number | null): string {
  return rate === null ? NO_STAT : `${Math.round(rate * 100)}%`;
}

export function formatMetaShare(share: number | null): string {
  return share === null ? NO_STAT : String(Number(share.toFixed(1)));
}

/** Deck count or percent, with at most one decimal. Accepts a decimal comma. */
export function parseMetaShare(draft: string): number | null {
  const trimmed = draft.trim().replace(",", ".");
  return /^\d{1,9}(?:\.\d)?$/u.test(trimmed) ? Number(trimmed) : null;
}

export function formatLegendCount(count: number | null): string {
  return count === null ? NO_STAT : String(count);
}

export function groupPlaceLabel(place: number): string {
  switch (place) {
    case 1: {
      return m.tournaments_group_place_winners();
    }
    case 2: {
      return m.tournaments_group_place_runners_up();
    }
    case 3: {
      return m.tournaments_group_place_thirds();
    }
    case 4: {
      return m.tournaments_group_place_fourths();
    }
    default: {
      return m.tournaments_group_place_other({ place });
    }
  }
}

export interface CutLineExplanation {
  heading: string;
  body: string;
}

export function cutLineExplanation(
  ranking: readonly GroupQualificationRowView[],
  cutSize: number,
): CutLineExplanation | null {
  const lastInIndex = ranking.findLastIndex((row) => row.qualified);
  const lastIn = ranking[lastInIndex];
  const firstOut = ranking[lastInIndex + 1];
  if (lastIn === undefined || firstOut === undefined || firstOut.qualified) {
    return null;
  }
  const names = {
    inName: participantName(lastIn.displayName),
    outName: participantName(firstOut.displayName),
  };
  const heading = m.tournaments_cut_line_heading({ ...names, size: cutSize });
  if (lastIn.place !== firstOut.place) {
    return {
      heading,
      body: m.tournaments_cut_line_place({
        ...names,
        inPlace: lastIn.place,
        inGroup: lastIn.groupLabel,
        outPlace: firstOut.place,
        outGroup: firstOut.groupLabel,
      }),
    };
  }
  const intro = m.tournaments_cut_line_same_place({ place: groupPlaceLabel(lastIn.place) });
  const mw = formatWinRate(lastIn.matchWinRate);
  const gw = formatWinRate(lastIn.gameWinRate);
  const reason = (() => {
    switch (firstOut.decidedBy) {
      case "mw": {
        return m.tournaments_cut_line_mw({
          ...names,
          inRate: mw,
          outRate: formatWinRate(firstOut.matchWinRate),
        });
      }
      case "gw": {
        return m.tournaments_cut_line_gw({
          ...names,
          mw,
          inRate: gw,
          outRate: formatWinRate(firstOut.gameWinRate),
        });
      }
      case "legend_count": {
        return m.tournaments_cut_line_legend_count({
          ...names,
          mw,
          gw,
          inCount: lastIn.legendCount ?? 0,
          outCount: firstOut.legendCount ?? 0,
        });
      }
      case "meta_share": {
        return m.tournaments_cut_line_meta_share({
          ...names,
          mw,
          gw,
          inShare: formatMetaShare(lastIn.metaShare),
          outShare: formatMetaShare(firstOut.metaShare),
        });
      }
      case "meta_pending": {
        return m.tournaments_cut_line_meta_pending({ mw, gw });
      }
      case "draw": {
        return m.tournaments_cut_line_draw({ ...names, mw, gw });
      }
      default: {
        return null;
      }
    }
  })();
  return reason === null ? null : { heading, body: `${intro} ${reason}` };
}
