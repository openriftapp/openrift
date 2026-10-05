import type {
  MetaArchiveJobs,
  MetaCatalogRow as MetaCatalogRowResponse,
  MetaSourceTemplate,
  MetaSyncSettings,
  MetaSyncStatus,
} from "@openrift/shared/contracts/admin/meta-catalog";
import { uvsgamesEventUrl } from "@openrift/shared/uvsgames-links";

import { isoOrNull } from "../../../lib/iso-date.js";
import type { JobRun } from "../../system/repositories/job-runs.js";
import type {
  MetaSyncSettingsRow,
  UvsgamesCoverageRow,
  UvsgamesTemplateRow,
} from "../repositories/uvsgames-events.js";
import { suggestTierForTemplateName } from "./meta-event-classify.js";
import { mapSourceFormat } from "./uvsgames-catalog.js";

/** `officialLabel` resolves the template uuid to its watched name; the uuid itself never reaches the client. */
export function toMetaCatalogRow(
  row: UvsgamesCoverageRow,
  vocabulary: {
    formatMappings: ReadonlyMap<string, string>;
    watchedTemplates: ReadonlyMap<string, string | null>;
  },
): MetaCatalogRowResponse {
  return {
    externalId: row.externalId,
    name: row.name,
    startAt: row.startAt.toISOString(),
    endAtEstimate: isoOrNull(row.endAtEstimate),
    displayStatus: row.displayStatus,
    decklistStatus: row.decklistStatus,
    playerCount: row.playerCount,
    eventType: row.eventType,
    eventFormat: row.eventFormat,
    mappedFormat: mapSourceFormat(vocabulary.formatMappings, row.eventFormat),
    officialLabel:
      row.eventConfigurationTemplate === null
        ? null
        : (vocabulary.watchedTemplates.get(row.eventConfigurationTemplate) ?? null),
    storeName: row.storeDisplayName,
    location: row.location,
    timezone: row.timezone,
    firstSeenAt: row.firstSeenAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
    missingSince: isoOrNull(row.missingSince),
    missingProbe: row.missingProbe,
    nextCheckAt: isoOrNull(row.nextCheckAt),
    checkStage: row.checkStage,
    triage: row.triage,
    metaEventId: row.metaEventId,
    metaEventSlug: row.metaEventSlug,
    fetchedAt: isoOrNull(row.fetchedAt),
    stagedPlayerCount: row.stagedPlayerCount,
    stagedLegendCount: row.stagedLegendCount,
    stagedDeckCount: row.stagedDeckCount,
    sourceUrl: uvsgamesEventUrl(row.externalId),
  };
}

/** `suggestedTier` is a name-rule guess, not stored, for prefilling an unmapped template. */
export function toMetaSourceTemplate(row: UvsgamesTemplateRow): MetaSourceTemplate {
  return {
    templateId: row.templateId,
    sourceName: row.sourceName,
    watched: row.watched,
    tier: row.tier,
    suggestedTier: suggestTierForTemplateName(row.sourceName),
    eventCount: row.eventCount,
    avgPlayers: row.avgPlayers,
    ranEventCount: row.ranEventCount,
    sampleEventName: row.sampleEventName,
    lastStartAt: isoOrNull(row.lastStartAt),
  };
}

export function toMetaSyncRun(run: JobRun): MetaArchiveJobs["runs"][number] {
  return {
    id: run.id,
    kind: run.kind,
    trigger: run.trigger,
    status: run.status,
    startedAt: run.startedAt.toISOString(),
    finishedAt: isoOrNull(run.finishedAt),
    durationMs: run.durationMs,
    errorMessage: run.errorMessage,
    result: (run.result ?? null) as Record<string, unknown> | null,
  };
}

export function toMetaSyncSettings(row: MetaSyncSettingsRow): MetaSyncSettings {
  return { ...row, updatedAt: row.updatedAt.toISOString() };
}

type MetaSyncCatalog = MetaSyncStatus["catalog"];

export function toMetaSyncCatalog(
  overview: Omit<MetaSyncCatalog, "oldestDueAt" | "lastSeenAt"> & {
    oldestDueAt: Date | null;
    lastSeenAt: Date | null;
  },
): MetaSyncCatalog {
  return {
    total: overview.total,
    completed: overview.completed,
    decklistPublished: overview.decklistPublished,
    missing: overview.missing,
    queued: overview.queued,
    dueRecheck: overview.dueRecheck,
    oldestDueAt: isoOrNull(overview.oldestDueAt),
    acceptedAwaitingResults: overview.acceptedAwaitingResults,
    acceptedMissing: overview.acceptedMissing,
    lastSeenAt: isoOrNull(overview.lastSeenAt),
  };
}
