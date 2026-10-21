import type { PlayriftboundCatalogRow } from "@openrift/shared/contracts/admin/meta-catalog";
import { playriftboundEventUrl } from "@openrift/shared/playriftbound-links";

import { isoOrNull } from "../../../lib/iso-date.js";
import type { PlayriftboundListRow } from "../repositories/playriftbound-events.js";

export function toPlayriftboundCatalogRow(row: PlayriftboundListRow): PlayriftboundCatalogRow {
  return {
    tournamentId: row.tournamentId,
    name: row.name,
    organizerName: row.organizerName,
    city: row.organizerCity,
    tournamentType: row.tournamentType,
    format: row.format,
    playerFormat: row.playerFormat,
    registeredCount: row.registeredCount,
    participantCapacity: row.participantCapacity,
    startAt: row.startAt.toISOString(),
    triage: row.triage,
    metaEventId: row.metaEventId,
    metaEventSlug: row.metaEventSlug,
    fetchedAt: isoOrNull(row.resultsFetchedAt),
    missingSince: isoOrNull(row.missingSince),
    nextCheckAt: isoOrNull(row.nextCheckAt),
    roundCount: row.roundCount,
    roundsPlayed: row.roundsPlayed,
    roundsFinalized: row.roundsFinalized,
    stagedPlayerCount: row.stagedPlayerCount,
    stagedMatchCount: row.stagedMatchCount,
    sourceUrl: playriftboundEventUrl(row.tournamentId),
  };
}
