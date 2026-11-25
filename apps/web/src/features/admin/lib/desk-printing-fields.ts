import type {
  DeskCreateInput,
  DeskReleasePrecision,
} from "@openrift/shared/contracts/admin/printing-desk";
import type { ReleasePrecision } from "@openrift/shared/set-release";
import { normalizeToPeriodStart } from "@openrift/shared/set-release";

export function normalizedRelease(
  releasedAt: string | null,
  precision: ReleasePrecision | null,
): { releasedAt: string | null; precision: DeskReleasePrecision | null } {
  if (!releasedAt) {
    return { releasedAt: null, precision: null };
  }
  const release = normalizeToPeriodStart({ releasedAt, precision });
  return { releasedAt: release.releasedAt, precision: release.precision as DeskReleasePrecision };
}

type DeskCreateFields = Omit<
  DeskCreateInput,
  "cardId" | "basePrintingId" | "duplicateFrom" | "secondSideFaceId"
>;

/** A TBA code sends no short code, a blank artist none, and a blank comment null. */
export function deskCreateFields(input: {
  setId: string;
  distributionChannelSlugs: readonly string[];
  markerSlugs: readonly string[];
  codeTba: boolean;
  shortCode: string;
  finish: string;
  language: string;
  size: string;
  artist: string;
  announcedAt: string | null;
  releasedAt: string | null;
  precision: ReleasePrecision | null;
  comment: string;
}): DeskCreateFields {
  const artist = input.artist.trim();
  const comment = input.comment.trim();
  const release = normalizedRelease(input.releasedAt, input.precision);
  return {
    setId: input.setId,
    distributionChannelSlugs: [...input.distributionChannelSlugs],
    markerSlugs: [...input.markerSlugs],
    codeTba: input.codeTba,
    shortCode: input.codeTba ? undefined : input.shortCode.trim(),
    finish: input.finish,
    language: input.language,
    size: input.size,
    artist: artist.length > 0 ? artist : undefined,
    announcedAt: input.announcedAt,
    releasedAt: release.releasedAt,
    releasePrecision: release.precision,
    comment: comment.length > 0 ? comment : null,
  };
}
