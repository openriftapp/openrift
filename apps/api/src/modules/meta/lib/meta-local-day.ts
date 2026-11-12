import { HOUR_MS, formatDay } from "@openrift/shared/format-date";

const DEGREES_PER_HOUR = 15;

/**
 * For sources that publish no timezone. Real zone borders and DST put it an
 * hour or two off, which moves the day only for an event near local midnight.
 */
export function longitudeLocalDay(startAt: Date, longitude: number | null): string {
  if (longitude === null) {
    return formatDay(startAt);
  }
  const offsetHours = Math.round(longitude / DEGREES_PER_HOUR);
  return formatDay(new Date(startAt.getTime() + offsetHours * HOUR_MS));
}
