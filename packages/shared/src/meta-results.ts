import type { MetaEventStatus } from "./types/enums.js";

export const META_RESULTS_STATES = ["notStarted", "collecting", "final", "noResults"] as const;
export type MetaResultsState = (typeof META_RESULTS_STATES)[number];

/** A published event's results state, from its stored lifecycle and how many standings it holds. */
export function metaResultsState(
  status: MetaEventStatus,
  playerRowCount: number,
): MetaResultsState {
  if (status === "upcoming") {
    return "notStarted";
  }
  if (status === "in_progress") {
    return "collecting";
  }
  return playerRowCount > 0 ? "final" : "noResults";
}

/** A published mirror row's results state, split as the sync buckets split it. */
export function mirrorResultsState(row: {
  started: boolean;
  hasResults: boolean;
  nextCheckAt: Date | string | null;
}): MetaResultsState {
  if (!row.started) {
    return "notStarted";
  }
  if (row.nextCheckAt !== null) {
    return "collecting";
  }
  return row.hasResults ? "final" : "noResults";
}
