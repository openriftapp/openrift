import { shiftUtcDay } from "./format-date.js";
import type { MetaEventStatus } from "./types/enums.js";

export const META_RESULTS_STATES = ["notStarted", "collecting", "final", "noResults"] as const;
export type MetaResultsState = (typeof META_RESULTS_STATES)[number];

export interface MetaEventLifecycle {
  recordedStatus: MetaEventStatus;
  eventDate: string;
  playerRowCount: number;
}

/**
 * An event may be running somewhere from the UTC day before its date to the day after (`today` is a
 * UTC day key). `UPCOMING` and `PLAYED` in the API's `meta-shared.ts` mirror this rule.
 */
export function metaEventStatus(event: MetaEventLifecycle, today: string): MetaEventStatus {
  if (event.eventDate > shiftUtcDay(today, 1)) {
    return "upcoming";
  }
  if (event.recordedStatus === "upcoming") {
    return event.eventDate >= shiftUtcDay(today, -1) ? "in_progress" : "complete";
  }
  if (
    event.recordedStatus === "complete" &&
    event.playerRowCount === 0 &&
    event.eventDate > today
  ) {
    return "upcoming";
  }
  return event.recordedStatus;
}

export function metaEventSourceStarted(event: Pick<MetaEventLifecycle, "recordedStatus">): boolean {
  return event.recordedStatus !== "upcoming";
}

export function metaResultsState(event: MetaEventLifecycle, today: string): MetaResultsState {
  const status = metaEventStatus(event, today);
  if (status === "upcoming") {
    return "notStarted";
  }
  if (status === "in_progress") {
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
