import { DAY_MS } from "@openrift/shared/format-date";

export function shiftDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * DAY_MS);
}
