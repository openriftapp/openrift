import type { CutSize } from "@openrift/shared/pairing/group-cut-types";
import type { FinalStandingRow, PodStandingRow } from "@openrift/shared/types/api/pod-tournament";

import type { PodiumSeat } from "@/components/ui/podium";
import { cutStageIndex } from "@/features/tournaments/lib/group-cut-display";
import {
  decidingTieBreak,
  formatPlayerRecord,
  formatScore,
  rankedStandings,
} from "@/features/tournaments/lib/standings-display";
import { m } from "@/paraglide/messages.js";

function seatHint(row: PodStandingRow, rival: PodStandingRow | undefined, swiss: boolean): string {
  const record = formatPlayerRecord(row, swiss);
  const tieBreak = rival === undefined ? null : decidingTieBreak(row, rival);
  return tieBreak === null ? record : `${record} · ${tieBreak}`;
}

export function podiumSeats(standings: readonly PodStandingRow[], swiss: boolean): PodiumSeat[] {
  const leader = standings[0];
  if (leader === undefined || leader.roundsPlayed === 0) {
    return [];
  }
  return rankedStandings(standings)
    .slice(0, 3)
    .map(({ row, rank }, index) => ({
      key: row.playerId,
      rank,
      name: row.displayName,
      image: row.image,
      gravatarHash: row.gravatarHash,
      score: formatScore(row.score),
      hint: seatHint(row, index === 0 ? standings[1] : standings[0], swiss),
    }));
}

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
  const index = cutStageIndex(cutSize, row.exitRound, all.length);
  return (
    (index === null ? undefined : all[index]) ??
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
      image: standing?.image ?? null,
      gravatarHash: standing?.gravatarHash ?? null,
      score: standing === undefined ? "" : formatScore(standing.score),
      hint: [record, exitLabel(row, cutSize)].filter((part) => part !== null).join(" · "),
    };
  });
}
