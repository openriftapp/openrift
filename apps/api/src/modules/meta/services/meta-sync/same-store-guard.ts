import type { Repos } from "../../../../deps.js";
import { nameSimilarity } from "../meta-match-suggestions.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
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

function dayOf(value: string): number {
  return Date.parse(`${value}T00:00:00Z`);
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
  const day = dayOf(candidate.eventDate);
  return live.find(
    (event) =>
      event.organizer !== null &&
      Math.abs(dayOf(event.eventDate) - day) <= MAX_DAY_DELTA * MS_PER_DAY &&
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
  const day = dayOf(candidate.eventDate);
  const shift = (days: number) => new Date(day + days * MS_PER_DAY).toISOString().slice(0, 10);
  const rows = await repos.meta.eventsAtStoresOutside({
    dateFrom: shift(-MAX_DAY_DELTA),
    dateTo: shift(MAX_DAY_DELTA),
    provider,
  });
  return findSameStoreEvent(candidate, rows);
}
