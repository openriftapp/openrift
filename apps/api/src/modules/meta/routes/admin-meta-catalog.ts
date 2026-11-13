import type { MetaCancellableJob, MetaSource } from "@openrift/shared/contracts/admin/meta-catalog";
import {
  adminMetaCatalogContract,
  isCatalogCheckpoint,
} from "@openrift/shared/contracts/admin/meta-catalog";
import { implement } from "@orpc/server";

import { AppError, badRequest, conflict } from "../../../errors.js";
import { assertFound } from "../../../lib/assertions.js";
import { UVSGAMES_PROVIDER } from "../../../lib/meta-providers.js";
import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { recordAdminEvent } from "../../system/services/record-admin-event.js";
import {
  toMetaSourceTemplate,
  toMetaSyncCatalog,
  toMetaSyncRun,
  toMetaSyncSettings,
} from "../lib/meta-catalog-presenters.js";
import { unpublishMetaEvent } from "../services/meta-remove.js";
import { isRepromoteNoop, repromoteMetaEvents } from "../services/meta-repromote.js";
import { isRetierNoop, retierMetaEvents } from "../services/meta-retier.js";
import { isIdSweepNoop, META_JOB_KINDS, sweepEventIds } from "../services/meta-sync/index.js";
import {
  adminMetaCatalogSourcesRouter,
  MIRRORS,
  mirrorEvents,
  startJob,
  syncDeps,
} from "./admin-meta-catalog-sources.js";

const os = implement(adminMetaCatalogContract).$context<ApiContext>().use(requireAuthedUser);

const ID_SWEEP_KIND = "meta.uvsgames_id_sweep";

const CANCELLABLE_KINDS: Partial<
  Record<`${MetaSource}:${MetaCancellableJob}`, (typeof META_JOB_KINDS)[number]>
> = {
  "uvsgames:backfill": "meta.uvsgames_backfill",
  "uvsgames:recheck": "meta.uvsgames_recheck",
  "uvsgames:id_sweep": ID_SWEEP_KIND,
  "playloltcg:backfill": "meta.playloltcg_backfill",
  "playloltcg:recheck": "meta.playloltcg_recheck",
  "topdeck:backfill": "meta.topdeck_backfill",
  "playriftbound:backfill": "meta.playriftbound_backfill",
  "playriftbound:recheck": "meta.playriftbound_recheck",
};

const STATUS_RUN_LIMIT = 25;

/**
 * Both sources' crons write into the same `job_runs` table, so an unfiltered
 * newest-25 buries one source's backfill and the resume state the panel reads off it.
 */
function jobKindsForSource(source: MetaSource): string[] {
  return META_JOB_KINDS.filter((kind) => kind.startsWith(`meta.${source}_`));
}

const ARCHIVE_JOB_KINDS = ["meta.retier", "meta.repromote"];

export const adminMetaCatalogRouter = {
  ...adminMetaCatalogSourcesRouter,

  bulkPublish: os.bulkPublish.handler(async ({ input, context }) => {
    const mirror = MIRRORS[input.source];
    const published: string[] = [];
    let skipped = 0;
    for (const key of new Set(input.keys)) {
      const row = await mirror.row(context, key);
      if (row?.triage !== "new") {
        skipped++;
        continue;
      }
      try {
        if ((await row.publish()) === null) {
          skipped++;
          continue;
        }
        published.push(key);
      } catch (error) {
        // An unmapped format needs a pick per row; the rest of the batch still goes.
        if (!(error instanceof AppError)) {
          throw error;
        }
        skipped++;
      }
    }
    await recordAdminEvent(context.repos, context.userId, {
      action: "meta-catalog.accept-bulk",
      entityType: "meta-catalog",
      entityId: mirror.provider,
      newValues: { published, skipped },
    });
    return { published, skipped };
  }),

  bulkReject: os.bulkReject.handler(async ({ input, context }) => {
    const mirror = MIRRORS[input.source];
    const keys: string[] = [];
    let skipped = 0;
    for (const key of new Set(input.keys)) {
      const row = await mirror.row(context, key);
      if (row?.triage === "new" && (await row.dismiss())) {
        keys.push(key);
      } else {
        skipped++;
      }
    }
    await recordAdminEvent(context.repos, context.userId, {
      action: "meta-catalog.dismiss-bulk",
      entityType: "meta-catalog",
      entityId: mirror.provider,
      newValues: { rejected: keys, skipped },
    });
    return { rejected: keys, skipped };
  }),

  bulkRestore: os.bulkRestore.handler(async ({ input, context }) => {
    const provider = MIRRORS[input.source].provider;
    let restored = 0;
    for (const key of new Set(input.keys)) {
      if (await context.repos.metaOverlays.unignoreEvent(provider, key)) {
        restored++;
      }
    }
    await recordAdminEvent(context.repos, context.userId, {
      action: "meta-catalog.undismiss-bulk",
      entityType: "meta-catalog",
      entityId: provider,
      newValues: { restored, keys: input.keys },
    });
    return { restored };
  }),

  bulkUnpublish: os.bulkUnpublish.handler(async ({ input, context }) => {
    const mirror = MIRRORS[input.source];
    let unpublished = 0;
    let kept = 0;
    for (const key of new Set(input.keys)) {
      const row = await mirror.row(context, key);
      if (row?.triage !== "accepted" || row.metaEventId === null) {
        continue;
      }
      const outcome = await unpublishMetaEvent(context.transact, row.metaEventId);
      if (outcome === "unpublished") {
        unpublished++;
      } else if (outcome === "kept") {
        kept++;
      }
    }
    await recordAdminEvent(context.repos, context.userId, {
      action: "meta-catalog.unpublish-bulk",
      entityType: "meta-catalog",
      entityId: mirror.provider,
      newValues: { unpublished, kept, keys: input.keys },
    });
    return { unpublished, kept };
  }),

  listTemplates: os.listTemplates.handler(async ({ context }) => {
    const rows = await context.repos.uvsgamesEvents.listTemplates();
    return { templates: rows.map((row) => toMetaSourceTemplate(row)) };
  }),

  // Templates are the sync's own rows, so this write never invents one: an
  // admin only says which of them to watch and what tier they map to.
  updateTemplate: os.updateTemplate.handler(async ({ input, context }) => {
    const patch = {
      ...(input.watched === undefined ? {} : { watched: input.watched }),
      ...(input.tier === undefined ? {} : { tier: input.tier }),
    };
    const row = await context.repos.uvsgamesEvents.updateTemplate(input.templateId, patch);
    assertFound(row, "Unknown template");
    if (Object.keys(patch).length > 0) {
      await recordAdminEvent(context.repos, context.userId, {
        action: "meta-catalog.template",
        entityType: "meta-catalog-template",
        entityId: input.templateId,
        entityLabel: row.sourceName ?? row.sampleEventName,
        newValues: patch,
      });
    }
    // Deliberately no promote: applying a mapping is `runRetier`, which the
    // maintainer runs once after a batch of edits.
    return toMetaSourceTemplate(row);
  }),

  listFormats: os.listFormats.handler(async ({ context }) => {
    const formats = await context.repos.uvsgamesEvents.listFormats();
    return { formats };
  }),

  updateFormat: os.updateFormat.handler(async ({ input, context }) => {
    if (input.mappedFormat !== null) {
      const known = await context.repos.deckFormats.getBySlug(input.mappedFormat);
      if (!known) {
        throw badRequest(`Unknown deck format "${input.mappedFormat}"`);
      }
    }
    const existing = await context.repos.uvsgamesEvents.formatByName(input.sourceFormat);
    assertFound(existing, "No mirrored event has this format");

    const updated = await context.repos.uvsgamesEvents.setFormatMapping(
      input.sourceFormat,
      input.mappedFormat,
    );
    assertFound(updated, "No mirrored event has this format");
    await recordAdminEvent(context.repos, context.userId, {
      action: "meta-catalog.format",
      entityType: "meta-catalog-format",
      entityId: input.sourceFormat,
      entityLabel: input.sourceFormat,
      oldValues: { mappedFormat: existing.mappedFormat },
      newValues: { mappedFormat: input.mappedFormat },
    });
    return updated;
  }),

  settings: os.settings.handler(async ({ context }) => {
    const row = await context.repos.uvsgamesEvents.settings();
    return toMetaSyncSettings(row);
  }),

  updateSettings: os.updateSettings.handler(async ({ input, context }) => {
    const row = await context.repos.uvsgamesEvents.updateSettings(input);
    await recordAdminEvent(context.repos, context.userId, {
      action: "meta-catalog.settings",
      entityType: "meta-catalog",
      entityId: UVSGAMES_PROVIDER,
      newValues: input,
    });
    return toMetaSyncSettings(row);
  }),

  archiveJobs: os.archiveJobs.handler(async ({ context }) => {
    const runs = await context.repos.jobRuns.listRecentByKinds(ARCHIVE_JOB_KINDS, STATUS_RUN_LIMIT);
    return { runs: runs.map((run) => toMetaSyncRun(run)) };
  }),

  syncStatus: os.syncStatus.handler(async ({ input, context }) => {
    const source = input.source;
    const sourceRepo = mirrorEvents(context.repos, source);
    const settings = await context.repos.uvsgamesEvents.settings();
    const [overview, archive, counts, recent, latest] = await Promise.all([
      sourceRepo.syncOverview(settings),
      context.repos.meta.archiveOverview(MIRRORS[source].provider),
      sourceRepo.triageCounts(),
      context.repos.jobRuns.listRecentByKinds(jobKindsForSource(source), STATUS_RUN_LIMIT),
      // A daily job falls out of the recent list behind a day of 10-minute rechecks.
      context.repos.jobRuns.latestByKinds(jobKindsForSource(source)),
    ]);
    const runs = [...new Map([...recent, ...latest].map((run) => [run.id, run])).values()].toSorted(
      (a, b) => b.startedAt.getTime() - a.startedAt.getTime(),
    );
    return {
      catalog: toMetaSyncCatalog(overview),
      archive,
      counts,
      runs: runs.map((run) => toMetaSyncRun(run)),
      schedules: {
        "meta.uvsgames_sync": context.scheduler?.isEnabled("meta.uvsgames_sync") ?? false,
        "meta.uvsgames_recheck": context.scheduler?.isEnabled("meta.uvsgames_recheck") ?? false,
        "meta.playloltcg_sync": context.scheduler?.isEnabled("meta.playloltcg_sync") ?? false,
        "meta.playloltcg_recheck": context.scheduler?.isEnabled("meta.playloltcg_recheck") ?? false,
        "meta.topdeck_sync": context.scheduler?.isEnabled("meta.topdeck_sync") ?? false,
        "meta.playriftbound_sync": context.scheduler?.isEnabled("meta.playriftbound_sync") ?? false,
        "meta.playriftbound_recheck":
          context.scheduler?.isEnabled("meta.playriftbound_recheck") ?? false,
      },
    };
  }),

  rejectPassingNoResults: os.rejectPassingNoResults.handler(async ({ input, context }) => {
    const settings = await context.repos.uvsgamesEvents.settings();
    const sourceRepo = mirrorEvents(context.repos, input.source);
    const provider = MIRRORS[input.source].provider;
    const keys = await sourceRepo.passingNoResultsKeys(settings);
    const rejected = await context.repos.metaOverlays.ignoreEvents(provider, keys);
    await recordAdminEvent(context.repos, context.userId, {
      action: "meta-catalog.dismiss-bulk",
      entityType: "meta-catalog",
      entityId: provider,
      newValues: { rejected, minPlayers: settings.autoAcceptMinPlayers },
    });
    return { rejected };
  }),

  // No resume point to look up here: the sweep's memory is `uvsgames_id_probes`.
  runIdSweep: os.runIdSweep.handler(({ input, context }) =>
    startJob(
      context,
      ID_SWEEP_KIND,
      syncDeps,
      (deps, runId) => sweepEventIds(deps, runId, input ?? {}),
      isIdSweepNoop,
    ),
  ),

  cancelRun: os.cancelRun.handler(async ({ input, context }) => {
    const { source, job } = input;
    const kind = CANCELLABLE_KINDS[`${source}:${job}`];
    if (kind === undefined) {
      throw badRequest(`${source} runs no ${job}`);
    }
    const running = await context.repos.jobRuns.getRunning(kind);
    assertFound(running, `No ${job} is running`);
    // Only recheck cancels without a checkpoint; backfill and the sweep read
    // the flag from their own heartbeat, so one must exist first.
    if (job !== "recheck") {
      const current = await context.repos.jobRuns.getResult(running.id);
      if (!isCatalogCheckpoint(current)) {
        // The crawl has not written its first heartbeat yet to read the flag
        // out of. A retry in a few seconds lands.
        throw conflict("Job is still initializing. Try again shortly.");
      }
    }
    await context.repos.jobRuns.requestCancel(running.id);
    return { runId: running.id, cancelRequested: true as const };
  }),

  runRetier: os.runRetier.handler(({ context }) =>
    startJob(
      context,
      "meta.retier",
      (ctx) => ctx.repos,
      (repos) => retierMetaEvents(repos),
      isRetierNoop,
    ),
  ),

  runRepromote: os.runRepromote.handler(({ context }) =>
    startJob(
      context,
      "meta.repromote",
      (ctx) => ctx.repos,
      (repos) => repromoteMetaEvents(repos),
      isRepromoteNoop,
    ),
  ),
};
