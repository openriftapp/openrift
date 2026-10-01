import type { ErrataListResponse } from "@openrift/shared/contracts/errata";

export function errataContentVersion(data: ErrataListResponse): number {
  const parts = [
    ...data.announcements.map((announcement) => `${announcement.id}:${announcement.publishedOn}`),
    ...data.entries.map(
      (entry) =>
        `${entry.card.slug}:${entry.announcementId ?? ""}:${entry.printing?.imageId ?? ""}`,
    ),
  ];
  let hash = 0;
  for (const char of parts.join("|")) {
    hash = (Math.imul(hash, 31) + (char.codePointAt(0) ?? 0)) >>> 0;
  }
  return hash;
}
