/**
 * Date/time formatting. Never uses `Intl` or locale-dependent methods: those
 * render differently on the server than in the visitor's browser, causing a
 * React hydration mismatch (error #418).
 *
 * Calendar days ({@link formatDay}, {@link formatMonth}) are always UTC.
 * Instants render in UTC ({@link formatDayTime}) or in the viewer's own
 * timezone ({@link formatDayTimeLocal}, `ssr: "data-only"` routes only).
 * Words come from a {@link DateWords} argument; the web app passes translated ones.
 */

const MONTH_ABBREVIATIONS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
] as const;

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** Month index 0-11, weekday index 0-6 from Sunday. */
export interface DateWords {
  monthName: (monthIndex: number) => string;
  monthAbbreviation: (monthIndex: number) => string;
  weekdayName: (weekdayIndex: number) => string;
  monthYear: (month: string, year: number) => string;
  weekdayDay: (weekday: string, day: number, month: string) => string;
  justNow: () => string;
  underAMinuteAhead: () => string;
  seconds: (count: number) => string;
  minutes: (count: number) => string;
  hours: (count: number) => string;
  hoursMinutes: (hours: number, minutes: number) => string;
  days: (count: number) => string;
  weeks: (count: number) => string;
  months: (count: number) => string;
  years: (count: number) => string;
  ago: (time: string) => string;
  ahead: (time: string) => string;
  today: () => string;
  yesterday: () => string;
  daysAgo: (count: number) => string;
  lastWeek: () => string;
  weeksAgo: (count: number) => string;
  lastMonth: () => string;
}

export const ENGLISH_DATE_WORDS: DateWords = {
  monthName: (index) => MONTH_NAMES[index] ?? "",
  monthAbbreviation: (index) => MONTH_ABBREVIATIONS[index] ?? "",
  weekdayName: (index) => WEEKDAY_NAMES[index] ?? "",
  monthYear: (month, year) => `${month} ${year}`,
  weekdayDay: (weekday, day, month) => `${weekday}, ${day} ${month}`,
  justNow: () => "just now",
  underAMinuteAhead: () => "in <1m",
  seconds: (count) => `${count}s`,
  minutes: (count) => `${count}m`,
  hours: (count) => `${count}h`,
  hoursMinutes: (hours, minutes) => `${hours}h ${minutes}m`,
  days: (count) => `${count}d`,
  weeks: (count) => `${count}w`,
  months: (count) => `${count}mo`,
  years: (count) => `${count}y`,
  ago: (time) => `${time} ago`,
  ahead: (time) => `in ${time}`,
  today: () => "Today",
  yesterday: () => "Yesterday",
  daysAgo: (count) => `${count} days ago`,
  lastWeek: () => "Last week",
  weeksAgo: (count) => `${count} weeks ago`,
  lastMonth: () => "Last month",
};

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Returns null on bad input; formatters render `""` for it. */
function toDate(input: Date | string): Date | null {
  const date = input instanceof Date ? input : new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * A `YYYY-MM-DD` string parses as UTC midnight, preserving the day; a full
 * instant takes its UTC calendar day.
 */
export function formatDay(input: Date | string): string {
  const date = toDate(input);
  return date === null ? "" : date.toISOString().slice(0, 10);
}

export function formatMonth(input: Date | string): string {
  const date = toDate(input);
  return date === null ? "" : date.toISOString().slice(0, 7);
}

/** `March 2026`, the UTC month spelled out. */
export function formatMonthYear(
  input: Date | string,
  words: DateWords = ENGLISH_DATE_WORDS,
): string {
  const date = toDate(input);
  if (date === null) {
    return "";
  }
  return words.monthYear(words.monthName(date.getUTCMonth()), date.getUTCFullYear());
}

/** UTC instant for admin/ops surfaces. */
export function formatDayTime(input: Date | string): string {
  const date = toDate(input);
  return date === null ? "" : date.toISOString().slice(0, 16).replace("T", " ");
}

/** Viewer's local day; use {@link formatDay} when the day is a property of the data, not the viewer's own. */
export function formatDayLocal(input: Date | string): string {
  const date = toDate(input);
  if (date === null) {
    return "";
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatTimeLocal(input: Date | string): string {
  const date = toDate(input);
  return date === null ? "" : `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Depends on the caller's timezone: safe only on `ssr: "data-only"` routes,
 * otherwise it causes a hydration mismatch (#418) for non-UTC visitors.
 */
export function formatDayTimeLocal(input: Date | string): string {
  const date = toDate(input);
  if (date === null) {
    return "";
  }
  return `${formatDayLocal(date)} ${formatTimeLocal(date)}`;
}

/** `Thursday` on the viewer's clock. Same SSR constraint as the other `…Local` functions. */
export function formatWeekdayLocal(
  input: Date | string,
  words: DateWords = ENGLISH_DATE_WORDS,
): string {
  const date = toDate(input);
  return date === null ? "" : words.weekdayName(date.getDay());
}

/** `Thursday, 11 September` on the viewer's clock. Same SSR constraint as the other `…Local` functions. */
export function formatWeekdayDayLocal(
  input: Date | string,
  words: DateWords = ENGLISH_DATE_WORDS,
): string {
  const date = toDate(input);
  if (date === null) {
    return "";
  }
  return words.weekdayDay(
    words.weekdayName(date.getDay()),
    date.getDate(),
    words.monthName(date.getMonth()),
  );
}

export function formatCompactUtcStamp(input: Date | string): string {
  const date = toDate(input);
  if (date === null) {
    return "";
  }
  const yyyy = date.getUTCFullYear().toString();
  const mm = pad(date.getUTCMonth() + 1);
  const dd = pad(date.getUTCDate());
  const hh = pad(date.getUTCHours());
  const mi = pad(date.getUTCMinutes());
  return `${yyyy}${mm}${dd}-${hh}${mi}`;
}

export interface DateLeafParts {
  month: string;
  day: string;
  year: string;
}

export function dateLeafParts(
  input: Date | string,
  words: DateWords = ENGLISH_DATE_WORDS,
): DateLeafParts {
  const date = toDate(input);
  if (date === null) {
    return { month: "", day: "", year: "" };
  }
  return {
    month: words.monthAbbreviation(date.getMonth()),
    day: String(date.getDate()),
    year: String(date.getFullYear()),
  };
}

/**
 * UTC, unlike {@link dateLeafParts}: an event's day is fixed globally, so a
 * reader at a negative offset must not see the day before.
 */
export function dateLeafPartsUtc(
  input: Date | string,
  words: DateWords = ENGLISH_DATE_WORDS,
): DateLeafParts {
  const date = toDate(input);
  if (date === null) {
    return { month: "", day: "", year: "" };
  }
  return {
    month: words.monthAbbreviation(date.getUTCMonth()),
    day: String(date.getUTCDate()),
    year: String(date.getUTCFullYear()),
  };
}

export interface RelativeTimeOptions {
  now?: Date;
  seconds?: boolean;
  compound?: boolean;
  words?: DateWords;
}

function magnitude(diffMs: number, seconds: boolean, compound: boolean, words: DateWords): string {
  const minutes = Math.floor(diffMs / MINUTE_MS);
  if (minutes < 1) {
    return seconds ? words.seconds(Math.floor(diffMs / 1000)) : "";
  }
  if (minutes < 60) {
    return words.minutes(minutes);
  }
  const hours = Math.floor(diffMs / HOUR_MS);
  if (hours < 24) {
    const remainder = minutes % 60;
    return compound && remainder > 0 ? words.hoursMinutes(hours, remainder) : words.hours(hours);
  }
  const days = Math.floor(diffMs / DAY_MS);
  if (days < 7) {
    return words.days(days);
  }
  if (days < 30) {
    return words.weeks(Math.floor(days / 7));
  }
  if (days < 365) {
    return words.months(Math.floor(days / 30));
  }
  return words.years(Math.floor(days / 365));
}

export function formatRelativeTime(
  input: Date | string,
  options: RelativeTimeOptions = {},
): string {
  const date = toDate(input);
  if (date === null) {
    return "";
  }
  const now = options.now ?? new Date();
  const diffMs = now.getTime() - date.getTime();
  const past = diffMs >= 0;
  const words = options.words ?? ENGLISH_DATE_WORDS;
  const label = magnitude(
    Math.abs(diffMs),
    options.seconds === true,
    options.compound === true,
    words,
  );
  if (label === "") {
    return past ? words.justNow() : words.underAMinuteAhead();
  }
  return past ? words.ago(label) : words.ahead(label);
}

/** Both sides compared in UTC, matching {@link formatDay}, so the bucket doesn't shift with the reader's timezone. */
export function formatRelativeDay(
  day: string,
  now: Date = new Date(),
  words: DateWords = ENGLISH_DATE_WORDS,
): string {
  const date = toDate(day);
  if (date === null) {
    return "";
  }
  const todayUtcMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const diffDays = Math.round((todayUtcMs - date.getTime()) / DAY_MS);

  if (diffDays === 0) {
    return words.today();
  }
  if (diffDays === 1) {
    return words.yesterday();
  }
  if (diffDays < 7) {
    return words.daysAgo(diffDays);
  }
  if (diffDays < 14) {
    return words.lastWeek();
  }
  if (diffDays < 30) {
    return words.weeksAgo(Math.floor(diffDays / 7));
  }
  if (diffDays < 60) {
    return words.lastMonth();
  }
  return formatDay(day);
}
