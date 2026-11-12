import type { AdminMetaSourceState } from "@openrift/shared/contracts/admin/meta";
import { pluralize } from "@openrift/shared/strings";

import type { CatalogChipDisplay } from "@/features/admin/lib/meta-catalog-display";
import {
  catalogStatusDisplay,
  META_SOURCE_LABELS,
  playloltcgStatusDisplay,
} from "@/features/admin/lib/meta-catalog-display";

export function sourceStateLifecycle(state: AdminMetaSourceState): CatalogChipDisplay | null {
  switch (state.provider) {
    case "uvsgames": {
      return state.status === null ? null : catalogStatusDisplay(state.status);
    }
    case "playloltcg": {
      return state.status === null ? null : (playloltcgStatusDisplay(Number(state.status)) ?? null);
    }
    case "playriftbound": {
      if (state.roundsPlayed === null && state.roundCount === null) {
        return null;
      }
      const of = state.roundCount === null ? "" : ` of ${state.roundCount}`;
      return { label: `Round ${state.roundsPlayed ?? 0}${of}`, variant: "outline" };
    }
    case "topdeck": {
      return null;
    }
  }
}

export function cancelledAtSourceText(
  cancelled: AdminMetaSourceState,
  standings: number,
  otherSources: number,
): string {
  const source = META_SOURCE_LABELS[cancelled.provider];
  const keeps = [
    ...(standings > 0 ? [`${standings} ${pluralize(standings, "standing", "standings")}`] : []),
    ...(otherSources > 0
      ? [`${otherSources} other ${pluralize(otherSources, "source", "sources")}`]
      : []),
  ];
  return keeps.length === 0
    ? `${source} lists this event as cancelled. It has no standings and no other source.`
    : `${source} lists this event as cancelled. It still has ${keeps.join(" and ")}.`;
}
