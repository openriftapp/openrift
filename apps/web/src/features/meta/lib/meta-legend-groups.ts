import { NO_LEGEND } from "@openrift/shared/meta-query";
import type { MetaEventField, MetaStandingsRow } from "@openrift/shared/types/api/meta";

export interface MetaLegendGroup {
  cardId: string;
  players: readonly MetaStandingsRow[];
}

/** Rows arrive in rank order, so each group opens on its best finish and groups follow it. */
export function groupStandingsByLegend(players: readonly MetaStandingsRow[]): MetaLegendGroup[] {
  const groups = [
    ...Map.groupBy(players, (player) => player.legend?.cardId ?? NO_LEGEND).entries(),
  ].map(([cardId, rows]) => ({ cardId, players: rows }));
  return [
    ...groups.filter((group) => group.cardId !== NO_LEGEND),
    ...groups.filter((group) => group.cardId === NO_LEGEND),
  ];
}

export function unknownLegendCount(legends: MetaEventField["legends"], total: number): number {
  return Math.max(0, total - legends.reduce((sum, legend) => sum + legend.count, 0));
}
