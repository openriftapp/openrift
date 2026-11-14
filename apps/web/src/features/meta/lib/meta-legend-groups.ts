import { NO_LEGEND } from "@openrift/shared/meta-query";
import type { MetaEventField, MetaStandingsRow } from "@openrift/shared/types/api/meta";

export const LEGEND_GROUP_ROWS = 5;
export const LEGEND_GROUPS_SHOWN = 12;

export interface LegendGroupRows {
  players: readonly MetaStandingsRow[] | undefined;
  isError: boolean;
  refetch: () => unknown;
}

export interface MetaLegendGroup {
  cardId: string;
  name: string;
  count: number;
  best: MetaStandingsRow | null;
}

export function legendGroups(
  legends: MetaEventField["legends"],
  bestPerLegend: readonly MetaStandingsRow[],
): MetaLegendGroup[] {
  const bestByCard = new Map(
    bestPerLegend.flatMap((row) => (row.legend === null ? [] : [[row.legend.cardId, row]])),
  );
  return legends
    .map((legend) => ({
      cardId: legend.cardId,
      name: legend.name,
      count: legend.count,
      best: bestByCard.get(legend.cardId) ?? null,
    }))
    .toSorted((a, b) => {
      if (a.best !== null && b.best !== null) {
        return a.best.rank - b.best.rank || a.name.localeCompare(b.name);
      }
      if (a.best !== null || b.best !== null) {
        return a.best === null ? 1 : -1;
      }
      return a.name.localeCompare(b.name);
    });
}

export function unknownLegendGroup(
  legends: MetaEventField["legends"],
  total: number,
): MetaLegendGroup | null {
  const named = legends.reduce((sum, legend) => sum + legend.count, 0);
  const count = total - named;
  return count > 0 ? { cardId: NO_LEGEND, name: "", count, best: null } : null;
}

export function openLegendIds(
  touched: readonly string[] | null,
  groups: readonly MetaLegendGroup[],
): readonly string[] {
  if (touched !== null) {
    return touched;
  }
  const first = groups[0];
  return first === undefined ? [] : [first.cardId];
}
