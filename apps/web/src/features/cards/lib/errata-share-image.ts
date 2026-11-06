import type { ErrataListResponse } from "@openrift/shared/contracts/errata";

import { errataEntryAnchor } from "@/features/cards/lib/errata-list";

export function errataContentVersion(data: ErrataListResponse): number {
  const parts = [
    ...data.announcements.map((announcement) => `${announcement.id}:${announcement.publishedOn}`),
    ...data.entries.map(
      (entry) =>
        `${errataEntryAnchor(entry.card.slug, entry.language)}:${entry.announcementId ?? ""}:${entry.printing?.imageId ?? ""}`,
    ),
  ];
  let hash = 0;
  for (const char of parts.join("|")) {
    hash = (Math.imul(hash, 31) + (char.codePointAt(0) ?? 0)) >>> 0;
  }
  return hash;
}
