import type { DeskPrintingRow } from "@openrift/shared/contracts/admin/printing-desk";
import type { SetRelease } from "@openrift/shared/set-release";
import { formatReleasePeriod, isReleased } from "@openrift/shared/set-release";

export type DeskPrintingStatus = "announced" | "released";

export const DESK_STATUS_LABELS: Record<DeskPrintingStatus, string> = {
  announced: "Announced",
  released: "Released",
};

/** The set fields are absent on rows that do not come from the desk; those use their own date only. */
export type ReleaseFields = Pick<DeskPrintingRow, "releasedAt" | "releasePrecision"> &
  Partial<Pick<DeskPrintingRow, "announcedAt" | "setReleasedAt" | "setReleasePrecision">>;

function inheritsSetRelease(row: ReleaseFields): boolean {
  return row.releasedAt === null && (row.setReleasedAt ?? null) !== null;
}

/** A printing's own date, else the release of its set in its language. */
export function deskPrintingRelease(row: ReleaseFields): SetRelease {
  return inheritsSetRelease(row)
    ? { releasedAt: row.setReleasedAt ?? null, precision: row.setReleasePrecision ?? null }
    : { releasedAt: row.releasedAt, precision: row.releasePrecision };
}

/** Null when neither the printing nor its set has a date and nothing was announced. */
export function deskPrintingStatus(row: ReleaseFields, today?: string): DeskPrintingStatus | null {
  const release = deskPrintingRelease(row);
  if (isReleased(release, today)) {
    return "released";
  }
  return release.releasedAt === null && (row.announcedAt ?? null) === null ? null : "announced";
}

export function deskPrintingPeriod(row: ReleaseFields): string {
  const period = formatReleasePeriod(deskPrintingRelease(row));
  return inheritsSetRelease(row) ? `${period} (set release)` : period;
}
