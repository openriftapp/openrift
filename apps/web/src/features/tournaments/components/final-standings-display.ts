import { GROUP_STAGE_ROUNDS } from "@openrift/shared/pairing/group-cut-types";
import type { CutSize } from "@openrift/shared/pairing/group-cut-types";
import type { FinalStandingRow, PodStandingRow } from "@openrift/shared/types/api/pod-tournament";

import type { PodiumSeat } from "@/components/ui/podium";
import {
  formatPlayerRecord,
  formatScore,
} from "@/features/tournaments/components/standings-display";
import { m } from "@/paraglide/messages.js";

export function exitLabel(row: FinalStandingRow, cutSize: CutSize): string {
  if (row.place === 1) {
    return m.tournaments_champion_label();
  }
  if (row.exitRound === null) {
    return m.tournaments_final_exit_group_stage();
  }
  const all = [
    m.tournaments_final_exit_lost_round_16(),
    m.tournaments_final_exit_lost_quarter(),
    m.tournaments_final_exit_lost_semi(),
    m.tournaments_final_exit_lost_final(),
  ];
  return (
    all.slice(all.length - Math.log2(cutSize))[row.exitRound - GROUP_STAGE_ROUNDS - 1] ??
    m.tournaments_round_band_round({ number: row.exitRound })
  );
}

export function finalStandingsSeats(
  rows: readonly FinalStandingRow[],
  standings: readonly PodStandingRow[],
  cutSize: CutSize,
): PodiumSeat[] {
  const byPlayer = new Map(standings.map((row) => [row.playerId, row]));
  return rows.slice(0, 3).map((row) => {
    const standing = byPlayer.get(row.playerId);
    const record = standing === undefined ? null : formatPlayerRecord(standing, true);
    return {
      key: row.playerId,
      rank: row.place,
      name: row.displayName,
      score: standing === undefined ? "" : formatScore(standing.score),
      hint: [record, exitLabel(row, cutSize)].filter((part) => part !== null).join(" · "),
    };
  });
}
