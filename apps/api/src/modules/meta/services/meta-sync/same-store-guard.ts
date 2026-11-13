import { shiftUtcDay, utcDayDiff } from "@openrift/shared/format-date";

import type { Repos } from "../../../../deps.js";
import { nameSimilarity } from "../meta-match-suggestions.js";

const MAX_DAY_DELTA = 1;
const MIN_STORE_SIMILARITY = 0.75;
const MIN_NAME_SIMILARITY = 0.5;

export interface SameStoreCandidate {
  name: string;
  /** `YYYY-MM-DD` */
  eventDate: string;
  organizer: string | null;
}

export interface SameStoreLiveEvent {
  id: string;
  name: string;
  eventDate: string;
  organizer: string | null;
}

/** One tournament listed on two platforms: the same store, within a day, under a similar name. */
export function findSameStoreEvent<T extends SameStoreLiveEvent>(
  candidate: SameStoreCandidate,
  live: readonly T[],
): T | undefined {
  const store = candidate.organizer;
  if (store === null) {
    return undefined;
  }
  return live.find(
    (event) =>
      event.organizer !== null &&
      Math.abs(utcDayDiff(candidate.eventDate, event.eventDate) ?? Infinity) <= MAX_DAY_DELTA &&
      nameSimilarity(store, event.organizer) >= MIN_STORE_SIMILARITY &&
      nameSimilarity(candidate.name, event.name) >= MIN_NAME_SIMILARITY,
  );
}

/**
 * Only another provider's events count: two events from one provider are two
 * tournaments, however alike their names and dates.
 */
export async function sameStoreLiveEvent(
  repos: Pick<Repos, "meta">,
  provider: string,
  candidate: SameStoreCandidate,
): Promise<SameStoreLiveEvent | undefined> {
  if (candidate.organizer === null) {
    return undefined;
  }
  const rows = await repos.meta.eventsAtStoresOutside({
    dateFrom: shiftUtcDay(candidate.eventDate, -MAX_DAY_DELTA),
    dateTo: shiftUtcDay(candidate.eventDate, MAX_DAY_DELTA),
    provider,
  });
  return findSameStoreEvent(candidate, rows);
}
