const MS_PER_HOUR = 3_600_000;
const DEGREES_PER_HOUR = 15;

/**
 * For sources that publish no timezone. Real zone borders and DST put it an
 * hour or two off, which moves the day only for an event near local midnight.
 */
export function longitudeLocalDay(startAt: Date, longitude: number | null): string {
  if (longitude === null) {
    return startAt.toISOString().slice(0, 10);
  }
  const offsetHours = Math.round(longitude / DEGREES_PER_HOUR);
  return new Date(startAt.getTime() + offsetHours * MS_PER_HOUR).toISOString().slice(0, 10);
}
