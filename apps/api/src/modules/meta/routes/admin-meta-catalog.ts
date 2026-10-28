import type { ScheduledJobKind } from "@openrift/shared/contracts/admin/job-schedules";
import type {
  MetaCancellableJob,
  MetaSource,
  MetaSyncTriggerResult,
} from "@openrift/shared/contracts/admin/meta-catalog";
import {
  adminMetaCatalogContract,
  isCatalogCheckpoint,
  isResumableCheckpoint,
} from "@openrift/shared/contracts/admin/meta-catalog";
import { ERROR_CODES } from "@openrift/shared/error-codes";
import { createLogger } from "@openrift/shared/logger";
import { implement } from "@orpc/server";

import { AppError } from "../../../errors.js";
import { assertExisted, assertFound } from "../../../lib/assertions.js";
import {
  PLAYLOLTCG_PROVIDER,
  PLAYRIFTBOUND_PROVIDER,
  TOPDECK_PROVIDER,
  UVSGAMES_PROVIDER,
} from "../../../lib/meta-providers.js";
import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { requireScheduler } from "../../system/services/job-scheduler.js";
import { recordAdminEvent } from "../../system/services/record-admin-event.js";
import { runJobAsync } from "../../system/services/run-job.js";
import {
  toMetaCatalogRow,
  toMetaSourceTemplate,
  toMetaSyncCatalog,
  toMetaSyncRun,
  toMetaSyncSettings,
} from "../lib/meta-catalog-presenters.js";
import { toPlayloltcgCatalogRow } from "../lib/playloltcg-catalog-presenters.js";
import { toPlayriftboundCatalogRow } from "../lib/playriftbound-catalog-presenters.js";
import { toTopdeckCatalogRow } from "../lib/topdeck-catalog-presenters.js";
import type { UvsgamesListRow } from "../repositories/uvsgames-events.js";
import { unpublishMetaEvent } from "../services/meta-remove.js";
import { isRepromoteNoop, repromoteMetaEvents } from "../services/meta-repromote.js";
import { isRetierNoop, retierMetaEvents } from "../services/meta-retier.js";
import type {
  MetaAutoAcceptSummary,
  MetaSyncDeps,
  PlayloltcgAcceptSummary,
  PlayloltcgSyncDeps,
  PlayriftboundAcceptSummary,
  PlayriftboundSyncDeps,
  TopdeckAcceptSummary,
  TopdeckSyncDeps,
} from "../services/meta-sync/index.js";
import {
  acceptCatalogEvent,
  autoAcceptCatalogBacklog,
  backfillCatalog,
  createMetaSyncDeps,
  fetchEventNow,
  isCatalogSyncNoop,
  isIdSweepNoop,
  isRecheckNoop,
  META_JOB_KINDS,
  processRechecks,
  sweepEventIds,
  acceptPlayloltcgEvent,
  autoAcceptPlayloltcgBacklog,
  backfillPlayloltcg,
  createPlayloltcgSyncDeps,
  fetchPlayloltcgEvent,
  isPlayloltcgRecheckNoop,
  isPlayloltcgSyncNoop,
  processPlayloltcgRechecks,
  acceptTopdeckEvent,
  autoAcceptTopdeckBacklog,
  backfillTopdeck,
  createTopdeckSyncDeps,
  isTopdeckSyncNoop,
  acceptPlayriftboundEvent,
  autoAcceptPlayriftboundBacklog,
  backfillPlayriftbound,
  createPlayriftboundSyncDeps,
  fetchPlayriftboundEvent,
  isPlayriftboundRecheckNoop,
  isPlayriftboundSyncNoop,
  processPlayriftboundRechecks,
} from "../services/meta-sync/index.js";

const log = createLogger("meta-sync");

const os = implement(adminMetaCatalogContract).$context<ApiContext>().use(requireAuthedUser);

const DEFAULT_LIMIT = 50;

const BACKFILL_KIND = "meta.uvsgames_backfill";
const PLAYLOLTCG_BACKFILL_KIND = "meta.playloltcg_backfill";
const TOPDECK_BACKFILL_KIND = "meta.topdeck_backfill";
const PLAYRIFTBOUND_BACKFILL_KIND = "meta.playriftbound_backfill";
const ID_SWEEP_KIND = "meta.uvsgames_id_sweep";

const CANCELLABLE_KINDS: Partial<
  Record<`${MetaSource}:${MetaCancellableJob}`, (typeof META_JOB_KINDS)[number]>
> = {
  "uvsgames:backfill": BACKFILL_KIND,
  "uvsgames:recheck": "meta.uvsgames_recheck",
  "uvsgames:id_sweep": ID_SWEEP_KIND,
  "playloltcg:backfill": PLAYLOLTCG_BACKFILL_KIND,
  "playloltcg:recheck": "meta.playloltcg_recheck",
  "topdeck:backfill": TOPDECK_BACKFILL_KIND,
  "playriftbound:backfill": PLAYRIFTBOUND_BACKFILL_KIND,
};

const UNSTOPPABLE_RECHECKS: ReadonlySet<MetaSource> = new Set(["playloltcg", "playriftbound"]);

function playloltcgDeps(context: ApiContext): PlayloltcgSyncDeps {
  return createPlayloltcgSyncDeps({
    repos: context.repos,
    transact: context.transact,
    fetch: context.io.fetch,
    log,
    baseUrl: context.config.metaSync.playloltcgBaseUrl,
  });
}

/**
 * The only source that authenticates. An unset key sends an empty
 * Authorization header, so the source 401s and the scheduled job skips itself.
 */
function topdeckDeps(context: ApiContext): TopdeckSyncDeps {
  return createTopdeckSyncDeps({
    repos: context.repos,
    transact: context.transact,
    fetch: context.io.fetch,
    log,
    baseUrl: context.config.metaSync.topdeckBaseUrl,
    apiKey: context.config.metaSync.topdeckApiKey ?? "",
  });
}

function playriftboundDeps(context: ApiContext): PlayriftboundSyncDeps {
  return createPlayriftboundSyncDeps({
    repos: context.repos,
    transact: context.transact,
    fetch: context.io.fetch,
    log,
    baseUrl: context.config.metaSync.playriftboundBaseUrl,
  });
}

const STATUS_RUN_LIMIT = 25;

const SOURCE_PROVIDER: Record<MetaSource, string> = {
  uvsgames: UVSGAMES_PROVIDER,
  playloltcg: PLAYLOLTCG_PROVIDER,
  topdeck: TOPDECK_PROVIDER,
  playriftbound: PLAYRIFTBOUND_PROVIDER,
};

/**
 * Both sources' crons write into the same `job_runs` table, so an unfiltered
 * newest-25 buries one source's backfill and the resume state the panel reads off it.
 */
function jobKindsForSource(source: MetaSource): string[] {
  return META_JOB_KINDS.filter((kind) => kind.startsWith(`meta.${source}_`));
}

const ARCHIVE_JOB_KINDS = ["meta.retier", "meta.repromote"];

function isAutoAcceptNoop(
  summary:
    | MetaAutoAcceptSummary
    | PlayloltcgAcceptSummary
    | TopdeckAcceptSummary
    | PlayriftboundAcceptSummary,
): boolean {
  return (
    summary.accepted === 0 &&
    summary.failed === 0 &&
    ("held" in summary ? summary.held === 0 : true)
  );
}

function syncDeps(context: ApiContext): MetaSyncDeps {
  return createMetaSyncDeps({
    repos: context.repos,
    transact: context.transact,
    fetch: context.io.fetch,
    log,
    baseUrl: context.config.metaSync.baseUrl,
  });
}

interface MirrorRowHandle {
  triage: string;
  metaEventId: string | null;
  publish: () => Promise<unknown>;
}

async function mirrorRow(
  context: ApiContext,
  source: MetaSource,
  key: string,
): Promise<MirrorRowHandle | undefined> {
  switch (source) {
    case "uvsgames": {
      const row = await context.repos.uvsgamesEvents.byKey(key);
      return row && { ...row, publish: () => acceptCatalogEvent(syncDeps(context), row, {}) };
    }
    case "playloltcg": {
      const id = Number(key);
      const row = Number.isSafeInteger(id)
        ? await context.repos.playloltcgEvents.byKey(id)
        : undefined;
      return row && { ...row, publish: () => acceptPlayloltcgEvent(playloltcgDeps(context), row) };
    }
    case "topdeck": {
      const row = await context.repos.topdeckEvents.byKey(key);
      return row && { ...row, publish: () => acceptTopdeckEvent(topdeckDeps(context), row) };
    }
    case "playriftbound": {
      const row = await context.repos.playriftboundEvents.byKey(key);
      return (
        row && { ...row, publish: () => acceptPlayriftboundEvent(playriftboundDeps(context), row) }
      );
    }
  }
}

async function requireRow(context: ApiContext, externalId: string): Promise<UvsgamesListRow> {
  const row = await context.repos.uvsgamesEvents.byKey(externalId);
  assertFound(row, "Mirrored event not found");
  return row;
}

/**
 * A full backfill walks a thousand pages at one request per second, which
 * outlives every gateway in front of this; the caller polls `job_runs`.
 */
async function startJob<TDeps, TResult>(
  context: ApiContext,
  kind: string,
  makeDeps: (context: ApiContext) => TDeps,
  work: (deps: TDeps, runId?: string) => Promise<TResult>,
  classifyNoop?: (result: TResult) => boolean,
): Promise<MetaSyncTriggerResult> {
  const deps = makeDeps(context);
  const started = await runJobAsync(
    { repos: context.repos, log },
    kind,
    "admin",
    (runId) => work(deps, runId),
    { summarize: (result) => result, classifyNoop },
  );
  return { status: started.status, runId: started.runId, message: null, result: null };
}

async function runScheduledJob(
  context: ApiContext,
  kind: ScheduledJobKind,
): Promise<MetaSyncTriggerResult> {
  const started = await requireScheduler(context.scheduler).runNow(kind);
  return { status: started.status, runId: started.runId, message: null, result: null };
}

/**
 * Accept and dismiss are the only two writes against a catalogue row, and
 * neither edits the mirror: accept mints the live event and promotes it,
 * dismiss writes the ignore key the ingest already honours.
 */
export const adminMetaCatalogRouter = {
  list: os.list.handler(async ({ input, context }) => {
    const limit = input.limit ?? DEFAULT_LIMIT;
    const page = input.page ?? 1;
    const rule = await context.repos.uvsgamesEvents.settings();
    const filters = {
      search: input.search,
      displayStatus: input.displayStatus,
      decklistPublished: input.decklistPublished,
      minPlayers: input.minPlayers,
      dateFrom: input.dateFrom === undefined ? undefined : new Date(input.dateFrom),
      dateTo: input.dateTo === undefined ? undefined : new Date(input.dateTo),
      triage: input.triage,
      missing: input.missing,
      bucket: input.bucket === undefined ? undefined : { name: input.bucket, rule },
    };
    const [{ rows, total }, buckets, formatMappings, watchedTemplates] = await Promise.all([
      context.repos.uvsgamesEvents.list(
        filters,
        { limit, offset: (page - 1) * limit },
        { sort: input.sort, direction: input.direction },
      ),
      context.repos.uvsgamesEvents.bucketCounts(filters, rule),
      context.repos.uvsgamesEvents.formatMappings(),
      context.repos.uvsgamesEvents.watchedTemplates(),
    ]);
    const vocabulary = { formatMappings, watchedTemplates };
    return {
      rows: rows.map((row) => toMetaCatalogRow(row, vocabulary)),
      total,
      page,
      limit,
      buckets,
    };
  }),

  accept: os.accept.handler(async ({ input, context }) => {
    const row = await requireRow(context, input.externalId);
    const accepted = await acceptCatalogEvent(syncDeps(context), row, { format: input.format });
    await recordAdminEvent(context.repos, context.userId, {
      action: "meta-catalog.accept",
      entityType: "meta-catalog",
      entityId: `${UVSGAMES_PROVIDER}:${row.externalId}`,
      entityLabel: row.name,
      newValues: { metaEventId: accepted.metaEventId, slug: accepted.slug },
    });
    return accepted;
  }),

  dismiss: os.dismiss.handler(async ({ input, context }) => {
    const row = await requireRow(context, input.externalId);
    await context.repos.metaOverlays.ignoreEvent(UVSGAMES_PROVIDER, row.externalId);
    await recordAdminEvent(context.repos, context.userId, {
      action: "meta-catalog.dismiss",
      entityType: "meta-catalog",
      entityId: `${UVSGAMES_PROVIDER}:${row.externalId}`,
      entityLabel: row.name,
    });
  }),

  undismiss: os.undismiss.handler(async ({ input, context }) => {
    const removed = await context.repos.metaOverlays.unignoreEvent(
      UVSGAMES_PROVIDER,
      input.externalId,
    );
    assertExisted(removed, "Ignore entry not found");
    await recordAdminEvent(context.repos, context.userId, {
      action: "meta-catalog.undismiss",
      entityType: "meta-catalog",
      entityId: `${UVSGAMES_PROVIDER}:${input.externalId}`,
    });
  }),

  bulkPublish: os.bulkPublish.handler(async ({ input, context }) => {
    const published: string[] = [];
    let skipped = 0;
    for (const key of new Set(input.keys)) {
      const row = await mirrorRow(context, input.source, key);
      if (row?.triage !== "new") {
        skipped++;
        continue;
      }
      try {
        await row.publish();
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
      entityId: SOURCE_PROVIDER[input.source],
      newValues: { published, skipped },
    });
    return { published, skipped };
  }),

  bulkReject: os.bulkReject.handler(async ({ input, context }) => {
    const keys: string[] = [];
    for (const key of new Set(input.keys)) {
      const row = await mirrorRow(context, input.source, key);
      if (row?.triage === "new") {
        keys.push(key);
      }
    }
    const provider = SOURCE_PROVIDER[input.source];
    await context.repos.metaOverlays.ignoreEvents(provider, keys);
    await recordAdminEvent(context.repos, context.userId, {
      action: "meta-catalog.dismiss-bulk",
      entityType: "meta-catalog",
      entityId: provider,
      newValues: { rejected: keys },
    });
    return { rejected: keys };
  }),

  bulkRestore: os.bulkRestore.handler(async ({ input, context }) => {
    const provider = SOURCE_PROVIDER[input.source];
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
    let unpublished = 0;
    let kept = 0;
    for (const key of new Set(input.keys)) {
      const row = await mirrorRow(context, input.source, key);
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
      entityId: SOURCE_PROVIDER[input.source],
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
        throw new AppError(
          400,
          ERROR_CODES.BAD_REQUEST,
          `Unknown deck format "${input.mappedFormat}"`,
        );
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
    const sourceRepo = {
      uvsgames: context.repos.uvsgamesEvents,
      playloltcg: context.repos.playloltcgEvents,
      topdeck: context.repos.topdeckEvents,
      playriftbound: context.repos.playriftboundEvents,
    }[source];
    const settings = await context.repos.uvsgamesEvents.settings();
    const [overview, archive, counts, recent, latest] = await Promise.all([
      sourceRepo.syncOverview(settings),
      context.repos.meta.archiveOverview(SOURCE_PROVIDER[source]),
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
    const sourceRepo = {
      uvsgames: context.repos.uvsgamesEvents,
      playloltcg: context.repos.playloltcgEvents,
      topdeck: context.repos.topdeckEvents,
      playriftbound: context.repos.playriftboundEvents,
    }[input.source];
    const provider = SOURCE_PROVIDER[input.source];
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

  runSync: os.runSync.handler(({ context }) => runScheduledJob(context, "meta.uvsgames_sync")),

  runBackfill: os.runBackfill.handler(async ({ context }) => {
    // A run that stopped early leaves a resume point behind and this picks it
    // up. `restartBackfill` is the way to ignore it.
    const previous = await context.repos.jobRuns.getLatestForResume(BACKFILL_KIND);
    const prior = previous?.result;
    const resumeFrom = isResumableCheckpoint(prior) ? new Date(prior.coveredThrough) : undefined;
    return await startJob(
      context,
      BACKFILL_KIND,
      syncDeps,
      (deps, runId) => backfillCatalog(deps, runId, { resumeFrom }),
      isCatalogSyncNoop,
    );
  }),

  restartBackfill: os.restartBackfill.handler(({ context }) =>
    startJob(
      context,
      BACKFILL_KIND,
      syncDeps,
      (deps, runId) => backfillCatalog(deps, runId),
      isCatalogSyncNoop,
    ),
  ),

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
    if (job === "recheck" && UNSTOPPABLE_RECHECKS.has(source)) {
      throw new AppError(
        400,
        ERROR_CODES.BAD_REQUEST,
        `The ${source} recheck cannot be stopped: it runs without a run id, so nothing there reads the flag.`,
      );
    }
    const kind = CANCELLABLE_KINDS[`${source}:${job}`];
    if (kind === undefined) {
      throw new AppError(400, ERROR_CODES.BAD_REQUEST, `${source} runs no ${job}`);
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
        throw new AppError(
          409,
          ERROR_CODES.CONFLICT,
          "Job is still initializing. Try again shortly.",
        );
      }
    }
    await context.repos.jobRuns.requestCancel(running.id);
    return { runId: running.id, cancelRequested: true as const };
  }),

  runRecheck: os.runRecheck.handler(({ context }) =>
    startJob(
      context,
      "meta.uvsgames_recheck",
      syncDeps,
      (deps, runId) => processRechecks(deps, { runId, listing: true }),
      isRecheckNoop,
    ),
  ),

  runAutoAccept: os.runAutoAccept.handler(({ context }) =>
    startJob(
      context,
      "meta.uvsgames_auto_accept",
      syncDeps,
      autoAcceptCatalogBacklog,
      isAutoAcceptNoop,
    ),
  ),

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

  runPlayloltcgSync: os.runPlayloltcgSync.handler(({ context }) =>
    runScheduledJob(context, "meta.playloltcg_sync"),
  ),

  runPlayloltcgRecheck: os.runPlayloltcgRecheck.handler(({ context }) =>
    startJob(
      context,
      "meta.playloltcg_recheck",
      playloltcgDeps,
      (deps) => processPlayloltcgRechecks(deps, { listing: true }),
      isPlayloltcgRecheckNoop,
    ),
  ),

  runPlayloltcgBackfill: os.runPlayloltcgBackfill.handler(async ({ context }) => {
    const previous = await context.repos.jobRuns.getLatestForResume(PLAYLOLTCG_BACKFILL_KIND);
    const prior = previous?.result;
    const resumeFrom = isResumableCheckpoint(prior) ? new Date(prior.coveredThrough) : undefined;
    return await startJob(
      context,
      PLAYLOLTCG_BACKFILL_KIND,
      playloltcgDeps,
      (deps, runId) => backfillPlayloltcg(deps, runId, { resumeFrom }),
      isPlayloltcgSyncNoop,
    );
  }),

  restartPlayloltcgBackfill: os.restartPlayloltcgBackfill.handler(({ context }) =>
    startJob(
      context,
      PLAYLOLTCG_BACKFILL_KIND,
      playloltcgDeps,
      (deps, runId) => backfillPlayloltcg(deps, runId),
      isPlayloltcgSyncNoop,
    ),
  ),

  runPlayloltcgAutoAccept: os.runPlayloltcgAutoAccept.handler(({ context }) =>
    startJob(
      context,
      "meta.playloltcg_auto_accept",
      playloltcgDeps,
      autoAcceptPlayloltcgBacklog,
      isAutoAcceptNoop,
    ),
  ),

  playloltcgList: os.playloltcgList.handler(async ({ input, context }) => {
    const limit = input.limit ?? DEFAULT_LIMIT;
    const page = input.page ?? 1;
    const rule = await context.repos.uvsgamesEvents.settings();
    const filters = {
      search: input.search,
      triage: input.triage,
      status: input.status,
      minPlayers: input.minPlayers,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      missing: input.missing,
      bucket: input.bucket === undefined ? undefined : { name: input.bucket, rule },
    };
    const [{ rows, total }, buckets] = await Promise.all([
      context.repos.playloltcgEvents.list(
        filters,
        { limit, offset: (page - 1) * limit },
        { sort: input.sort, direction: input.direction },
      ),
      context.repos.playloltcgEvents.bucketCounts(filters, rule),
    ]);
    return { rows: rows.map((row) => toPlayloltcgCatalogRow(row)), total, page, limit, buckets };
  }),

  playloltcgAccept: os.playloltcgAccept.handler(async ({ input, context }) => {
    const row = await context.repos.playloltcgEvents.byKey(input.activityShopId);
    assertFound(row, "Mirrored event not found");
    const accepted = await acceptPlayloltcgEvent(playloltcgDeps(context), row);
    await recordAdminEvent(context.repos, context.userId, {
      action: "meta-catalog.accept",
      entityType: "meta-catalog",
      entityId: `${PLAYLOLTCG_PROVIDER}:${row.activityShopId}`,
      entityLabel: row.name,
      newValues: { metaEventId: accepted.metaEventId, slug: accepted.slug },
    });
    return accepted;
  }),

  playloltcgDismiss: os.playloltcgDismiss.handler(async ({ input, context }) => {
    const row = await context.repos.playloltcgEvents.byKey(input.activityShopId);
    assertFound(row, "Mirrored event not found");
    await context.repos.metaOverlays.ignoreEvent(PLAYLOLTCG_PROVIDER, String(row.activityShopId));
    await recordAdminEvent(context.repos, context.userId, {
      action: "meta-catalog.dismiss",
      entityType: "meta-catalog",
      entityId: `${PLAYLOLTCG_PROVIDER}:${row.activityShopId}`,
      entityLabel: row.name,
    });
  }),

  playloltcgUndismiss: os.playloltcgUndismiss.handler(async ({ input, context }) => {
    const externalId = String(input.activityShopId);
    const removed = await context.repos.metaOverlays.unignoreEvent(PLAYLOLTCG_PROVIDER, externalId);
    assertExisted(removed, "Ignore entry not found");
    await recordAdminEvent(context.repos, context.userId, {
      action: "meta-catalog.undismiss",
      entityType: "meta-catalog",
      entityId: `${PLAYLOLTCG_PROVIDER}:${externalId}`,
    });
  }),

  playloltcgFetchEvent: os.playloltcgFetchEvent.handler(async ({ input, context }) => {
    const row = await context.repos.playloltcgEvents.byKey(input.activityShopId);
    assertFound(row, "Mirrored event not found");
    if (row.metaEventId === null) {
      throw new AppError(
        400,
        ERROR_CODES.BAD_REQUEST,
        "Publish this event before collecting its results.",
      );
    }
    return await startJob(context, "meta.playloltcg_event_fetch", playloltcgDeps, (deps) =>
      fetchPlayloltcgEvent(deps, row),
    );
  }),

  runTopdeckSync: os.runTopdeckSync.handler(({ context }) =>
    runScheduledJob(context, "meta.topdeck_sync"),
  ),

  runTopdeckBackfill: os.runTopdeckBackfill.handler(async ({ context }) => {
    const previous = await context.repos.jobRuns.getLatestForResume(TOPDECK_BACKFILL_KIND);
    const prior = previous?.result;
    const resumeFrom = isResumableCheckpoint(prior) ? new Date(prior.coveredThrough) : undefined;
    return await startJob(
      context,
      TOPDECK_BACKFILL_KIND,
      topdeckDeps,
      (deps, runId) => backfillTopdeck(deps, runId, { resumeFrom }),
      isTopdeckSyncNoop,
    );
  }),

  restartTopdeckBackfill: os.restartTopdeckBackfill.handler(({ context }) =>
    startJob(
      context,
      TOPDECK_BACKFILL_KIND,
      topdeckDeps,
      (deps, runId) => backfillTopdeck(deps, runId),
      isTopdeckSyncNoop,
    ),
  ),

  runTopdeckAutoAccept: os.runTopdeckAutoAccept.handler(({ context }) =>
    startJob(
      context,
      "meta.topdeck_auto_accept",
      topdeckDeps,
      autoAcceptTopdeckBacklog,
      isAutoAcceptNoop,
    ),
  ),

  topdeckList: os.topdeckList.handler(async ({ input, context }) => {
    const limit = input.limit ?? DEFAULT_LIMIT;
    const page = input.page ?? 1;
    const rule = await context.repos.uvsgamesEvents.settings();
    const filters = {
      search: input.search,
      triage: input.triage,
      format: input.format,
      minPlayers: input.minPlayers,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      missing: input.missing,
      bucket: input.bucket === undefined ? undefined : { name: input.bucket, rule },
    };
    const [{ rows, total }, buckets] = await Promise.all([
      context.repos.topdeckEvents.list(
        filters,
        { limit, offset: (page - 1) * limit },
        { sort: input.sort, direction: input.direction },
      ),
      context.repos.topdeckEvents.bucketCounts(filters, rule),
    ]);
    return { rows: rows.map((row) => toTopdeckCatalogRow(row)), total, page, limit, buckets };
  }),

  topdeckAccept: os.topdeckAccept.handler(async ({ input, context }) => {
    const row = await context.repos.topdeckEvents.byKey(input.tid);
    assertFound(row, "Mirrored event not found");
    const accepted = await acceptTopdeckEvent(topdeckDeps(context), row);
    await recordAdminEvent(context.repos, context.userId, {
      action: "meta-catalog.accept",
      entityType: "meta-catalog",
      entityId: `${TOPDECK_PROVIDER}:${row.tid}`,
      entityLabel: row.name,
      newValues: { metaEventId: accepted.metaEventId, slug: accepted.slug },
    });
    return accepted;
  }),

  topdeckDismiss: os.topdeckDismiss.handler(async ({ input, context }) => {
    const row = await context.repos.topdeckEvents.byKey(input.tid);
    assertFound(row, "Mirrored event not found");
    await context.repos.metaOverlays.ignoreEvent(TOPDECK_PROVIDER, row.tid);
    await recordAdminEvent(context.repos, context.userId, {
      action: "meta-catalog.dismiss",
      entityType: "meta-catalog",
      entityId: `${TOPDECK_PROVIDER}:${row.tid}`,
      entityLabel: row.name,
    });
  }),

  topdeckUndismiss: os.topdeckUndismiss.handler(async ({ input, context }) => {
    const removed = await context.repos.metaOverlays.unignoreEvent(TOPDECK_PROVIDER, input.tid);
    assertExisted(removed, "Ignore entry not found");
    await recordAdminEvent(context.repos, context.userId, {
      action: "meta-catalog.undismiss",
      entityType: "meta-catalog",
      entityId: `${TOPDECK_PROVIDER}:${input.tid}`,
    });
  }),

  runPlayriftboundSync: os.runPlayriftboundSync.handler(({ context }) =>
    runScheduledJob(context, "meta.playriftbound_sync"),
  ),

  runPlayriftboundRecheck: os.runPlayriftboundRecheck.handler(({ context }) =>
    startJob(
      context,
      "meta.playriftbound_recheck",
      playriftboundDeps,
      (deps) => processPlayriftboundRechecks(deps, { rearm: true }),
      isPlayriftboundRecheckNoop,
    ),
  ),

  // The checkpoint here is a cell index.
  runPlayriftboundBackfill: os.runPlayriftboundBackfill.handler(async ({ context }) => {
    const previous = await context.repos.jobRuns.getLatestForResume(PLAYRIFTBOUND_BACKFILL_KIND);
    const prior = previous?.result;
    const cell = isResumableCheckpoint(prior) ? Number(prior.coveredThrough) : Number.NaN;
    const resumeFrom = Number.isInteger(cell) ? cell : undefined;
    return await startJob(
      context,
      PLAYRIFTBOUND_BACKFILL_KIND,
      playriftboundDeps,
      (deps, runId) => backfillPlayriftbound(deps, runId, { resumeFrom }),
      isPlayriftboundSyncNoop,
    );
  }),

  restartPlayriftboundBackfill: os.restartPlayriftboundBackfill.handler(({ context }) =>
    startJob(
      context,
      PLAYRIFTBOUND_BACKFILL_KIND,
      playriftboundDeps,
      (deps, runId) => backfillPlayriftbound(deps, runId),
      isPlayriftboundSyncNoop,
    ),
  ),

  runPlayriftboundAutoAccept: os.runPlayriftboundAutoAccept.handler(({ context }) =>
    startJob(
      context,
      "meta.playriftbound_auto_accept",
      playriftboundDeps,
      autoAcceptPlayriftboundBacklog,
      isAutoAcceptNoop,
    ),
  ),

  playriftboundList: os.playriftboundList.handler(async ({ input, context }) => {
    const limit = input.limit ?? DEFAULT_LIMIT;
    const page = input.page ?? 1;
    const rule = await context.repos.uvsgamesEvents.settings();
    const filters = {
      search: input.search,
      triage: input.triage,
      tournamentType: input.tournamentType,
      format: input.format,
      minPlayers: input.minPlayers,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      missing: input.missing,
      bucket: input.bucket === undefined ? undefined : { name: input.bucket, rule },
    };
    const [{ rows, total }, buckets] = await Promise.all([
      context.repos.playriftboundEvents.list(
        filters,
        { limit, offset: (page - 1) * limit },
        { sort: input.sort, direction: input.direction },
      ),
      context.repos.playriftboundEvents.bucketCounts(filters, rule),
    ]);
    return { rows: rows.map((row) => toPlayriftboundCatalogRow(row)), total, page, limit, buckets };
  }),

  playriftboundAccept: os.playriftboundAccept.handler(async ({ input, context }) => {
    const row = await context.repos.playriftboundEvents.byKey(input.tournamentId);
    assertFound(row, "Mirrored event not found");
    const accepted = await acceptPlayriftboundEvent(playriftboundDeps(context), row);
    await recordAdminEvent(context.repos, context.userId, {
      action: "meta-catalog.accept",
      entityType: "meta-catalog",
      entityId: `${PLAYRIFTBOUND_PROVIDER}:${row.tournamentId}`,
      entityLabel: row.name,
      newValues: { metaEventId: accepted.metaEventId, slug: accepted.slug },
    });
    return accepted;
  }),

  playriftboundDismiss: os.playriftboundDismiss.handler(async ({ input, context }) => {
    const row = await context.repos.playriftboundEvents.byKey(input.tournamentId);
    assertFound(row, "Mirrored event not found");
    await context.repos.metaOverlays.ignoreEvent(PLAYRIFTBOUND_PROVIDER, row.tournamentId);
    await recordAdminEvent(context.repos, context.userId, {
      action: "meta-catalog.dismiss",
      entityType: "meta-catalog",
      entityId: `${PLAYRIFTBOUND_PROVIDER}:${row.tournamentId}`,
      entityLabel: row.name,
    });
  }),

  playriftboundUndismiss: os.playriftboundUndismiss.handler(async ({ input, context }) => {
    const removed = await context.repos.metaOverlays.unignoreEvent(
      PLAYRIFTBOUND_PROVIDER,
      input.tournamentId,
    );
    assertExisted(removed, "Ignore entry not found");
    await recordAdminEvent(context.repos, context.userId, {
      action: "meta-catalog.undismiss",
      entityType: "meta-catalog",
      entityId: `${PLAYRIFTBOUND_PROVIDER}:${input.tournamentId}`,
    });
  }),

  playriftboundFetchEvent: os.playriftboundFetchEvent.handler(async ({ input, context }) => {
    const row = await context.repos.playriftboundEvents.byKey(input.tournamentId);
    assertFound(row, "Mirrored event not found");
    if (row.metaEventId === null) {
      throw new AppError(
        400,
        ERROR_CODES.BAD_REQUEST,
        "Publish this event before collecting its results.",
      );
    }
    return await startJob(context, "meta.playriftbound_event_fetch", playriftboundDeps, (deps) =>
      fetchPlayriftboundEvent(deps, row),
    );
  }),

  // Five upstream requests at 30s each outlive the proxy's read timeout: the
  // gateway 405s the dead POST, but the run keeps going and reports its runId.
  fetchEvent: os.fetchEvent.handler(async ({ input, context }) => {
    const row = await requireRow(context, input.externalId);
    if (row.metaEventId === null) {
      throw new AppError(
        400,
        ERROR_CODES.BAD_REQUEST,
        "Publish this event before collecting its results.",
      );
    }
    return await startJob(context, "meta.uvsgames_event_fetch", syncDeps, (deps, runId) =>
      fetchEventNow(deps, row, runId),
    );
  }),
};
