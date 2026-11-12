export const HOUR_MS = 60 * 60 * 1000;

export const DAY_MS = 24 * HOUR_MS;

export function shiftDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * DAY_MS);
}
