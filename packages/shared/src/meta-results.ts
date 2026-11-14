import type { MetaEventStatus } from "./types/enums.js";

export const META_RESULTS_STATES = ["notStarted", "collecting", "final", "noResults"] as const;
export type MetaResultsState = (typeof META_RESULTS_STATES)[number];

/**
 * A published event's results state. Upcoming is the stored lifecycle or a
 * date after `today` (a UTC day key): a hand-entered event defaults to complete.
 */
export function metaResultsState(
  event: { status: MetaEventStatus; eventDate: string; playerRowCount: number },
  today: string,
): MetaResultsState {
  if (event.status === "upcoming" || event.eventDate > today) {
    return "notStarted";
  }
  if (event.status === "in_progress") {
    return "collecting";
  }
  return event.playerRowCount > 0 ? "final" : "noResults";
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
