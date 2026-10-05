import type { PlayloltcgCatalogRow } from "@openrift/shared/contracts/admin/meta-catalog";

import { isoOrNull } from "../../../lib/iso-date.js";
import type { PlayloltcgListRow } from "../repositories/playloltcg-events.js";
import { playloltcgEventUrl } from "./playloltcg-catalog.js";

export function toPlayloltcgCatalogRow(row: PlayloltcgListRow): PlayloltcgCatalogRow {
  return {
    activityShopId: row.activityShopId,
    name: row.name,
    shopName: row.shopDisplayName,
    city: row.city,
    status: row.status,
    battleMode: row.battleMode,
    playerCount: row.playerCount,
    startAt: row.startAt,
    triage: row.triage,
    metaEventId: row.metaEventId,
    metaEventSlug: row.metaEventSlug,
    fetchedAt: isoOrNull(row.fetchedAt),
    missingSince: isoOrNull(row.missingSince),
    nextCheckAt: isoOrNull(row.nextCheckAt),
    stagedPlayerCount: row.stagedPlayerCount,
    stagedLegendCount: row.stagedLegendCount,
    stagedDeckCount: row.stagedDeckCount,
    sourceUrl: playloltcgEventUrl(row.activityShopId),
  };
}
