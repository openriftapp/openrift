import { compareCardDisplayName, legendDisplayName } from "@openrift/shared/card-name";
import { matchesCardQuery } from "@openrift/shared/card-search";
import type {
  ErrataAnnouncement,
  ErrataEntry,
  ErrataListResponse,
} from "@openrift/shared/contracts/errata";
import { slugifyName } from "@openrift/shared/strings";

export const UNANNOUNCED_GROUP_ID = "unannounced-changes";

export interface ErrataGroup {
  id: string;
  announcement: ErrataAnnouncement | null;
  total: number;
  entries: ErrataEntry[];
}

export interface ErrataFilters {
  query: string;
  setSlug: string | null;
}

export function errataGroupId(announcement: ErrataAnnouncement): string {
  return slugifyName(announcement.name);
}

function matchesFilters(entry: ErrataEntry, filters: ErrataFilters): boolean {
  if (filters.setSlug !== null && entry.printing?.setSlug !== filters.setSlug) {
    return false;
  }
  return matchesCardQuery(filters.query, [
    legendDisplayName(entry.card),
    entry.correctedRulesText,
    entry.correctedEffectText,
  ]);
}

function compareUnannounced(left: ErrataEntry, right: ErrataEntry): number {
  if (left.effectiveDate !== right.effectiveDate) {
    if (left.effectiveDate === null) {
      return 1;
    }
    if (right.effectiveDate === null) {
      return -1;
    }
    return right.effectiveDate.localeCompare(left.effectiveDate);
  }
  return compareCardDisplayName(left.card, right.card);
}

export function groupErrata(data: ErrataListResponse, filters: ErrataFilters): ErrataGroup[] {
  const byAnnouncement = Map.groupBy(data.entries, (entry) => entry.announcementId);

  const groups: ErrataGroup[] = data.announcements
    .toSorted(
      (left, right) =>
        right.publishedOn.localeCompare(left.publishedOn) || left.name.localeCompare(right.name),
    )
    .map((announcement) => {
      const all = byAnnouncement.get(announcement.id) ?? [];
      return {
        id: errataGroupId(announcement),
        announcement,
        total: all.length,
        entries: all
          .filter((entry) => matchesFilters(entry, filters))
          .toSorted((left, right) => compareCardDisplayName(left.card, right.card)),
      };
    })
    .filter((group) => group.total > 0);

  const unannounced = byAnnouncement.get(null) ?? [];
  if (unannounced.length > 0) {
    groups.push({
      id: UNANNOUNCED_GROUP_ID,
      announcement: null,
      total: unannounced.length,
      entries: unannounced
        .filter((entry) => matchesFilters(entry, filters))
        .toSorted(compareUnannounced),
    });
  }
  return groups;
}

export function errataGroupIdForCard(data: ErrataListResponse, cardSlug: string): string | null {
  const entry = data.entries.find((candidate) => candidate.card.slug === cardSlug);
  if (entry === undefined) {
    return null;
  }
  if (entry.announcementId === null) {
    return UNANNOUNCED_GROUP_ID;
  }
  const announcement = data.announcements.find((item) => item.id === entry.announcementId);
  return announcement === undefined ? null : errataGroupId(announcement);
}

export function countErrataBySet(entries: readonly ErrataEntry[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    if (entry.printing) {
      counts.set(entry.printing.setSlug, (counts.get(entry.printing.setSlug) ?? 0) + 1);
    }
  }
  return counts;
}

export function latestErrataUpdate(announcements: readonly ErrataAnnouncement[]): string | null {
  return announcements.reduce<string | null>(
    (latest, announcement) =>
      latest === null || announcement.publishedOn > latest ? announcement.publishedOn : latest,
    null,
  );
}
