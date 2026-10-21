/**
 * Release status must be derived from the date, never stored as a separate
 * flag, or the two could disagree.
 */

import { formatDay, formatMonth, todayUtc } from "./format-date.js";

export type ReleasePrecision = "day" | "month" | "quarter" | "year";

/** releasedAt is the period's first day; precision says how wide. Both null means announced with no date yet. */
export interface SetRelease {
  releasedAt: string | null;
  precision: ReleasePrecision | null;
}

/** A set's releases keyed by language code. A missing key means not announced. */
export type SetReleases = Record<string, SetRelease>;

export function releasePeriodEnd(release: SetRelease): string | null {
  const { releasedAt, precision } = release;
  if (!releasedAt || !precision) {
    return null;
  }
  const year = Number(releasedAt.slice(0, 4));
  const month = Number(releasedAt.slice(5, 7));
  if (precision === "day") {
    return releasedAt;
  }
  // Day 0 of the following month is the last day of the month before it, so
  // this needs no leap-year special case.
  const endMonth = precision === "year" ? 12 : precision === "quarter" ? month + 2 : month;
  return new Date(Date.UTC(year, endMonth, 0)).toISOString().slice(0, 10);
}

export function normalizeToPeriodStart(release: SetRelease): SetRelease {
  const { releasedAt, precision } = release;
  if (!releasedAt || !precision || precision === "day") {
    return release;
  }
  const year = releasedAt.slice(0, 4);
  if (precision === "year") {
    return { releasedAt: `${year}-01-01`, precision };
  }
  const month = Number(releasedAt.slice(5, 7));
  const startMonth = precision === "quarter" ? Math.floor((month - 1) / 3) * 3 + 1 : month;
  return { releasedAt: `${year}-${String(startMonth).padStart(2, "0")}-01`, precision };
}

// Compares against the period's end, so a set stays "unreleased" until its
// full period passes. Being late is the safe direction under the Riot license.
export function isReleased(release: SetRelease | undefined, today = todayUtc()): boolean {
  if (!release) {
    return false;
  }
  const end = releasePeriodEnd(release);
  return end !== null && end <= today;
}

export function isReleasedIn(releases: SetReleases, language: string, today = todayUtc()): boolean {
  return isReleased(releases[language], today);
}

export function earliestRelease(releases: SetReleases): SetRelease | undefined {
  let earliest: SetRelease | undefined;
  for (const release of Object.values(releases)) {
    if (release.releasedAt && (!earliest?.releasedAt || release.releasedAt < earliest.releasedAt)) {
      earliest = release;
    }
  }
  return earliest;
}

export function isReleasedAnywhere(releases: SetReleases, today = todayUtc()): boolean {
  return Object.values(releases).some((release) => isReleased(release, today));
}

export function formatReleasePeriod(release: SetRelease | undefined): string {
  if (!release?.releasedAt || !release.precision) {
    return "TBA";
  }
  const { releasedAt, precision } = release;
  const year = releasedAt.slice(0, 4);
  if (precision === "year") {
    return year;
  }
  if (precision === "quarter") {
    return `${year}-Q${Math.floor((Number(releasedAt.slice(5, 7)) - 1) / 3) + 1}`;
  }
  if (precision === "month") {
    return formatMonth(releasedAt);
  }
  return formatDay(releasedAt);
}

const RELEASE_INPUT = /^(?<year>\d{4})(?:-(?<month>\d{2})(?:-(?<day>\d{2}))?)?$/u;
const PRECISION_WIDTH: Record<ReleasePrecision, number> = { day: 0, month: 1, quarter: 2, year: 3 };

/** Snaps to the period start; a missing precision follows the input's shape. Null when the
 * date is malformed or the precision is finer than the input. */
export function parseReleaseInput(
  value: string | null,
  precision: ReleasePrecision | null,
): SetRelease | null {
  if (value === null) {
    return precision === null ? { releasedAt: null, precision: null } : null;
  }
  const groups = RELEASE_INPUT.exec(value)?.groups;
  if (groups?.year === undefined) {
    return null;
  }
  const releasedAt = `${groups.year}-${groups.month ?? "01"}-${groups.day ?? "01"}`;
  const parsed = new Date(`${releasedAt}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== releasedAt) {
    return null;
  }
  const implied: ReleasePrecision =
    groups.day === undefined ? (groups.month === undefined ? "year" : "month") : "day";
  const resolved = precision ?? implied;
  if (PRECISION_WIDTH[resolved] < PRECISION_WIDTH[implied]) {
    return null;
  }
  return normalizeToPeriodStart({ releasedAt, precision: resolved });
}
