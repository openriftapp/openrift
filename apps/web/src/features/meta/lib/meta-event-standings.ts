import type { MetaEventField } from "@openrift/shared/types/api/meta";

import { m } from "@/paraglide/messages.js";

export const ANY_LEGEND = "any";

/** The legends the field played, alphabetical. Keyed by card id so legends sharing a champion stay apart. */
export function legendOptions(legends: MetaEventField["legends"]): Record<string, string> {
  if (legends.length < 2) {
    return {};
  }
  return {
    [ANY_LEGEND]: m.meta_standings_any_legend(),
    ...Object.fromEntries(
      legends.map((legend) => [legend.cardId, `${legend.name} (${legend.count})`]),
    ),
  };
}

export interface RowSlot {
  "data-index"?: number;
  ref?: (node: HTMLElement | null) => void;
  style?: React.CSSProperties;
}

export interface StandingsColumns {
  legend: boolean;
  run: boolean;
  record: boolean;
  value: boolean;
  deck: boolean;
}

export function standingsColumns(field: MetaEventField, canSubmit: boolean): StandingsColumns {
  const anyList = field.withLists > 0;
  return {
    legend: field.hasLegends,
    run: field.hasRuns,
    record: field.hasRecords,
    value: anyList,
    deck: canSubmit || anyList,
  };
}

export function subtitleFor(total: number, withLists: number): string {
  const entries = m.meta_standings_count_entries({ count: total });
  if (withLists === 0) {
    return entries;
  }
  return `${entries} · ${m.meta_standings_count_with_decklist({ count: withLists })}`;
}
