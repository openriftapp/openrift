import {
  DAY_MS,
  ENGLISH_DATE_WORDS,
  formatRelativeTime,
  MINUTE_MS,
} from "@openrift/shared/format-date";
import type { DateWords } from "@openrift/shared/format-date";
import { countNoun, pluralize } from "@openrift/shared/strings";

import type { OverlayList, OverlaySnapshot } from "./overlay-snapshot";

const LONG_DATE_WORDS: DateWords = {
  ...ENGLISH_DATE_WORDS,
  minutes: (count) => countNoun(count, "minute"),
  hours: (count) => countNoun(count, "hour"),
  days: (count) => countNoun(count, "day"),
  weeks: (count) => countNoun(count, "week"),
  months: (count) => countNoun(count, "month"),
  years: (count) => countNoun(count, "year"),
};

export function relativeAge(from: string, now: Date): string {
  const elapsed = now.getTime() - new Date(from).getTime();
  if (Number.isNaN(elapsed) || elapsed < MINUTE_MS) {
    return "just now";
  }
  return formatRelativeTime(from, { now, words: LONG_DATE_WORDS });
}

const NAMES_SHOWN = 3;

export function listNames(names: readonly string[]): string {
  if (names.length <= NAMES_SHOWN) {
    return names.join(", ");
  }
  const rest = names.length - NAMES_SHOWN;
  return `${names.slice(0, NAMES_SHOWN).join(", ")} and ${rest} more`;
}

const STALE_AFTER_MS = 2 * DAY_MS;

const LISTS_SHOWN = 4;

export interface SyncStatus {
  lists: OverlayList[];
  more: number;
  lastSync?: string;
  stale: boolean;
}

export function syncStatus(snapshot: OverlaySnapshot | undefined, now: Date): SyncStatus {
  if (snapshot === undefined) {
    return { lists: [], more: 0, stale: true };
  }
  return {
    lists: snapshot.lists.slice(0, LISTS_SHOWN),
    more: Math.max(0, snapshot.lists.length - LISTS_SHOWN),
    lastSync: relativeAge(snapshot.capturedAt, now),
    stale: now.getTime() - new Date(snapshot.capturedAt).getTime() >= STALE_AFTER_MS,
  };
}

export function entriesLabel(entryCount?: number): string | undefined {
  if (entryCount === undefined) {
    return undefined;
  }
  return `${entryCount.toLocaleString()} ${pluralize(entryCount, "entry", "entries")}`;
}

export function snapshotSummary(snapshot: OverlaySnapshot | undefined, now: Date): string {
  const status = syncStatus(snapshot, now);
  if (snapshot === undefined || status.lastSync === undefined) {
    return "No lists synchronized yet.";
  }
  return `${listNames(snapshot.lists.map((list) => list.name))}, synchronized ${status.lastSync}.`;
}
