// Date-entry helpers for a DatePicker plus an HH:mm field. Inputs are on the
// viewer's local clock; the stored value is a UTC ISO instant.

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;

export function isValidTimeInput(time: string): boolean {
  return TIME_PATTERN.test(time);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function parseLocalDate(value: string): Date | null {
  if (!DATE_PATTERN.test(value)) {
    return null;
  }
  const [year = 0, month = 0, day = 0] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

export function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function combineLocalDateTimeToUtc(date: string, time: string): string | null {
  const day = parseLocalDate(date);
  if (day === null || !isValidTimeInput(time)) {
    return null;
  }
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  day.setHours(hour, minute, 0, 0);
  return day.toISOString();
}

interface OptionalLocalInstant {
  instant: string | null;
  incomplete: boolean;
}

export function parseOptionalLocalInstant(date: string, time: string): OptionalLocalInstant {
  if (date === "" && time === "") {
    return { instant: null, incomplete: false };
  }
  const instant = combineLocalDateTimeToUtc(date, time);
  return { instant, incomplete: instant === null };
}

export function sameInstant(a: string | null, b: string | null): boolean {
  if (a === null || b === null) {
    return a === b;
  }
  return Date.parse(a) === Date.parse(b);
}

export function splitUtcToLocalDateTime(iso: string): { date: string; time: string } {
  const dt = new Date(iso);
  return {
    date: formatLocalDate(dt),
    time: `${pad(dt.getHours())}:${pad(dt.getMinutes())}`,
  };
}

export function localTimeZoneLabel(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
