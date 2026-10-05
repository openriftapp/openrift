// Date-entry helpers for a DatePicker plus an HH:mm field. Inputs are on the
// viewer's local clock; the stored value is a UTC ISO instant.

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;

export function isValidTimeInput(time: string): boolean {
  return TIME_PATTERN.test(time);
}

export function combineLocalDateTimeToUtc(date: string, time: string): string | null {
  if (!DATE_PATTERN.test(date) || !isValidTimeInput(time)) {
    return null;
  }
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if (year === undefined || month === undefined) {
    return null;
  }
  return new Date(year, month - 1, day, hour, minute, 0, 0).toISOString();
}

export function splitUtcToLocalDateTime(iso: string): { date: string; time: string } {
  const dt = new Date(iso);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return {
    date: `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`,
    time: `${pad(dt.getHours())}:${pad(dt.getMinutes())}`,
  };
}

export function localTimeZoneLabel(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
