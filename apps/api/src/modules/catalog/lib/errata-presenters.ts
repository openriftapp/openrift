import type { ErrataListResponse } from "@openrift/shared/contracts/errata";

import type { Repos } from "../../../deps.js";

type AnnouncementRow = Awaited<ReturnType<Repos["cardErrata"]["announcements"]>>[number];
type EntryRow = Awaited<ReturnType<Repos["cardErrata"]["listEntries"]>>[number];

export function buildErrataListResponse(
  announcements: readonly AnnouncementRow[],
  rows: readonly EntryRow[],
): ErrataListResponse {
  const setsBySlug = new Map<string, { slug: string; name: string; sortOrder: number }>();
  for (const row of rows) {
    if (row.setSlug !== null && row.setName !== null && row.setSortOrder !== null) {
      setsBySlug.set(row.setSlug, {
        slug: row.setSlug,
        name: row.setName,
        sortOrder: row.setSortOrder,
      });
    }
  }

  return {
    announcements: announcements.map(({ id, name, publishedOn, url }) => ({
      id,
      name,
      publishedOn,
      url,
    })),
    sets: [...setsBySlug.values()]
      .toSorted((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .map(({ slug, name }) => ({ slug, name })),
    entries: rows.map((row) => ({
      announcementId: row.announcementId,
      source: row.source,
      sourceUrl: row.sourceUrl,
      effectiveDate: row.effectiveDate,
      correctedRulesText: row.correctedRulesText,
      correctedEffectText: row.correctedEffectText,
      card: {
        slug: row.slug,
        name: row.name,
        types: row.types,
        tags: row.tags,
        domains: row.domains,
      },
      printing:
        row.shortCode === null || row.setSlug === null
          ? null
          : {
              shortCode: row.shortCode,
              setSlug: row.setSlug,
              printedRulesText: row.printedRulesText,
              printedEffectText: row.printedEffectText,
              imageId: row.imageId,
            },
    })),
  };
}
