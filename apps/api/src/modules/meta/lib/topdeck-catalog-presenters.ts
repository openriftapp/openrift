import type { TopdeckCatalogRow } from "@openrift/shared/contracts/admin/meta-catalog";

import { isoOrNull } from "../../../lib/iso-date.js";
import type { TopdeckListRow } from "../repositories/topdeck-events.js";
import { topdeckEventUrl } from "./topdeck-catalog.js";

/** No recheck column: a catalogued row already has its standings, so the staged counts are the whole fetch story. */
export function toTopdeckCatalogRow(row: TopdeckListRow): TopdeckCatalogRow {
  return {
    tid: row.tid,
    name: row.name,
    format: row.format,
    city: row.city,
    country: row.country,
    playerCount: row.playerCount,
    topCut: row.topCut,
    isTeamEvent: row.isTeamEvent,
    startAt: row.startAt.toISOString(),
    triage: row.triage,
    metaEventId: row.metaEventId,
    metaEventSlug: row.metaEventSlug,
    fetchedAt: isoOrNull(row.fetchedAt),
    missingSince: isoOrNull(row.missingSince),
    stagedPlayerCount: row.stagedPlayerCount,
    stagedLegendCount: row.stagedLegendCount,
    stagedDeckCount: row.stagedDeckCount,
    rivalProvider: row.rivalProvider,
    sourceUrl: topdeckEventUrl(row.tid),
  };
}
