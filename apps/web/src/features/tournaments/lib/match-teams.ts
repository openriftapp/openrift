/**
 * Presentation constants for the match tracker's 2v2 teams. Fixed info/warning
 * tokens (not theme chart tokens, which collapse to near-identical shades in
 * some themes) so the two teams stay clearly distinguishable around the table.
 */

import { m } from "@/paraglide/messages.js";

export function teamLabels(): Record<0 | 1, string> {
  return {
    0: m.tournaments_lib_team_label_1(),
    1: m.tournaments_lib_team_label_2(),
  };
}

export const TEAM_PANEL_BORDER: Record<0 | 1, string> = {
  0: "border-info/70",
  1: "border-warning/70",
};

export const TEAM_CHIP: Record<0 | 1, string> = {
  0: "bg-info-soft text-info",
  1: "bg-warning-soft text-warning",
};
