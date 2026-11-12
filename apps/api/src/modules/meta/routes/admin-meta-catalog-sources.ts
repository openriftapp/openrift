import type { ScheduledJobKind } from "@openrift/shared/contracts/admin/job-schedules";
import type {
  MetaCatalogSort,
  MetaCatalogSortDirection,
  MetaSource,
  MetaSyncBucketFilter,
  MetaSyncTriggerResult,
} from "@openrift/shared/contracts/admin/meta-catalog";
import {
  adminMetaCatalogContract,
  isResumableCheckpoint,
} from "@openrift/shared/contracts/admin/meta-catalog";
import { ERROR_CODES } from "@openrift/shared/error-codes";
import { createLogger } from "@openrift/shared/logger";
import type { InferSchemaOutput } from "@orpc/contract";
import { implement } from "@orpc/server";

import type { Repos } from "../../../deps.js";
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
import { toMetaCatalogRow } from "../lib/meta-catalog-presenters.js";
import { toPlayloltcgCatalogRow } from "../lib/playloltcg-catalog-presenters.js";
import { toPlayriftboundCatalogRow } from "../lib/playriftbound-catalog-presenters.js";
import { toTopdeckCatalogRow } from "../lib/topdeck-catalog-presenters.js";
import type {
  MetaAutoPublishRule,
  MetaSyncBucketCounts,
} from "../repositories/meta-sync-buckets.js";
import type { PlayloltcgListRow } from "../repositories/playloltcg-events.js";
import type { PlayriftboundListRow } from "../repositories/playriftbound-events.js";
import type { TopdeckListRow } from "../repositories/topdeck-events.js";
import type { UvsgamesListRow } from "../repositories/uvsgames-events.js";
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
  isRecheckNoop,
  processRechecks,
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

type AuthedContext = ApiContext & { userId: string };
type CatalogContract = typeof adminMetaCatalogContract;
type CatalogQuery<K extends keyof CatalogContract> = InferSchemaOutput<
  NonNullable<CatalogContract[K]["~orpc"]["inputSchema"]>
>;

const DEFAULT_LIMIT = 50;

export function syncDeps(context: ApiContext): MetaSyncDeps {
  return createMetaSyncDeps({
    repos: context.repos,
    transact: context.transact,
    fetch: context.io.fetch,
    log,
    baseUrl: context.config.metaSync.baseUrl,
  });
}

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

export function mirrorEvents(repos: Repos, source: MetaSource) {
  return {
    uvsgames: repos.uvsgamesEvents,
    playloltcg: repos.playloltcgEvents,
    topdeck: repos.topdeckEvents,
    playriftbound: repos.playriftboundEvents,
  }[source];
}

/**
 * A full backfill walks a thousand pages at one request per second, which
 * outlives every gateway in front of this; the caller polls `job_runs`.
 */
export async function startJob<TDeps, TResult>(
  context: ApiContext,
  kind: string,
  makeDeps: (context: ApiContext) => TDeps,
  work: (deps: TDeps, runId?: string) => Promise<TResult>,
  classifyNoop?: (result: TResult) => boolean,
): Promise<MetaSyncTriggerResult> {
  const deps = makeDeps({
    ...context,
    repos: context.backgroundRepos,
    transact: context.backgroundTransact,
  });
  const started = await runJobAsync(
    { repos: context.backgroundRepos, log },
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

type SourceJob = (options: { context: ApiContext }) => Promise<MetaSyncTriggerResult>;

function scheduledJob(kind: ScheduledJobKind): SourceJob {
  return ({ context }) => runScheduledJob(context, kind);
}

function sourceJobs<TDeps>(makeDeps: (context: ApiContext) => TDeps) {
  return {
    job<TResult>(
      kind: string,
      work: (deps: TDeps, runId?: string) => Promise<TResult>,
      classifyNoop?: (result: TResult) => boolean,
    ): SourceJob {
      return ({ context }) => startJob(context, kind, makeDeps, work, classifyNoop);
    },

    // A run that stopped early leaves a resume point behind and `backfill`
    // picks it up. `restartBackfill` is the way to ignore it.
    backfill<TResume, TResult>(
      kind: string,
      work: (deps: TDeps, runId?: string, options?: { resumeFrom?: TResume }) => Promise<TResult>,
      classifyNoop: (result: TResult) => boolean,
      readResume: (prior: unknown) => TResume | undefined,
    ): { backfill: SourceJob; restartBackfill: SourceJob } {
      return {
        backfill: async ({ context }) => {
          const previous = await context.repos.jobRuns.getLatestForResume(kind);
          const resumeFrom = readResume(previous?.result);
          return await startJob(
            context,
            kind,
            makeDeps,
            (deps, runId) => work(deps, runId, { resumeFrom }),
            classifyNoop,
          );
        },
        restartBackfill: ({ context }) =>
          startJob(context, kind, makeDeps, (deps, runId) => work(deps, runId), classifyNoop),
      };
    },

    eventFetch<TRow>(
      kind: string,
      work: (deps: TDeps, row: TRow, runId?: string) => Promise<unknown>,
    ): (context: ApiContext, row: TRow) => Promise<MetaSyncTriggerResult> {
      return (context, row) =>
        startJob(context, kind, makeDeps, (deps, runId) => work(deps, row, runId));
    },
  };
}

function resumeFromInstant(prior: unknown): Date | undefined {
  return isResumableCheckpoint(prior) ? new Date(prior.coveredThrough) : undefined;
}

function resumeFromCell(prior: unknown): number | undefined {
  const cell = isResumableCheckpoint(prior) ? Number(prior.coveredThrough) : Number.NaN;
  return Number.isInteger(cell) ? cell : undefined;
}

interface BucketFilter {
  name: MetaSyncBucketFilter;
  rule: MetaAutoPublishRule;
}

interface CatalogListQuery {
  page?: number;
  limit?: number;
  sort?: MetaCatalogSort;
  direction?: MetaCatalogSortDirection;
  bucket?: MetaSyncBucketFilter;
}

interface MirrorListing<TFilters, TRow> {
  list: (
    filters: TFilters,
    page: { limit: number; offset: number },
    order: { sort?: MetaCatalogSort; direction?: MetaCatalogSortDirection },
  ) => Promise<{ rows: TRow[]; total: number }>;
  bucketCounts: (
    filters: TFilters,
    rule: MetaAutoPublishRule,
  ) => Promise<MetaSyncBucketCounts | null>;
}

/** The auto-publish rule is one setting for every source, so every page reads it off uvsgames. */
function catalogList<TQuery extends CatalogListQuery, TFilters, TRow, TOut>(spec: {
  events: (repos: Repos) => MirrorListing<TFilters, TRow>;
  filters: (query: TQuery, bucket: BucketFilter | undefined) => TFilters;
  presenter: (repos: Repos) => Promise<(row: TRow) => TOut>;
}) {
  return async ({ input, context }: { input: TQuery; context: ApiContext }) => {
    const limit = input.limit ?? DEFAULT_LIMIT;
    const page = input.page ?? 1;
    const rule = await context.repos.uvsgamesEvents.settings();
    const filters = spec.filters(
      input,
      input.bucket === undefined ? undefined : { name: input.bucket, rule },
    );
    const events = spec.events(context.repos);
    const [{ rows, total }, buckets, present] = await Promise.all([
      events.list(
        filters,
        { limit, offset: (page - 1) * limit },
        { sort: input.sort, direction: input.direction },
      ),
      events.bucketCounts(filters, rule),
      spec.presenter(context.repos),
    ]);
    return { rows: rows.map((row) => present(row)), total, page, limit, buckets };
  };
}

interface MirroredEvent {
  name: string;
  triage: string;
  metaEventId: string | null;
}

interface AcceptedEvent {
  metaEventId: string;
  slug: string;
  created: boolean;
}

interface AcceptOptions {
  format?: string;
}

interface MirrorEvents<TKey, TRow extends MirroredEvent, TDeps> {
  provider: string;
  byKey: (repos: Repos, key: TKey) => Promise<TRow | undefined>;
  parseKey: (key: string) => TKey | undefined;
  keyText: (key: TKey) => string;
  deps: (context: ApiContext) => TDeps;
  accept: (deps: TDeps, row: TRow, options: AcceptOptions) => Promise<AcceptedEvent>;
}

interface CatalogSource<
  TKeyInput,
  TKey,
  TRow extends MirroredEvent,
  TDeps,
  TListQuery,
> extends MirrorEvents<TKey, TRow, TDeps> {
  keyOf: (input: TKeyInput) => TKey;
  list: (options: { input: TListQuery; context: ApiContext }) => Promise<unknown>;
  sync: SourceJob;
  backfill: SourceJob;
  restartBackfill: SourceJob;
  autoAccept: SourceJob;
  recheck?: SourceJob;
  fetchEvent?: (context: ApiContext, row: TRow) => Promise<MetaSyncTriggerResult>;
}

const uvsgamesJobs = sourceJobs(syncDeps);

const UVSGAMES = {
  provider: UVSGAMES_PROVIDER,
  keyOf: (input) => input.externalId,
  byKey: (repos, key) => repos.uvsgamesEvents.byKey(key),
  parseKey: (key) => key,
  keyText: (key) => key,
  deps: syncDeps,
  accept: (deps, row, options) => acceptCatalogEvent(deps, row, options),
  list: catalogList({
    events: (repos: Repos) => repos.uvsgamesEvents,
    filters: (query: CatalogQuery<"list">, bucket) => ({
      search: query.search,
      displayStatus: query.displayStatus,
      decklistPublished: query.decklistPublished,
      minPlayers: query.minPlayers,
      dateFrom: query.dateFrom === undefined ? undefined : new Date(query.dateFrom),
      dateTo: query.dateTo === undefined ? undefined : new Date(query.dateTo),
      triage: query.triage,
      missing: query.missing,
      bucket,
    }),
    presenter: async (repos) => {
      const [formatMappings, watchedTemplates] = await Promise.all([
        repos.uvsgamesEvents.formatMappings(),
        repos.uvsgamesEvents.watchedTemplates(),
      ]);
      return (row) => toMetaCatalogRow(row, { formatMappings, watchedTemplates });
    },
  }),
  sync: scheduledJob("meta.uvsgames_sync"),
  ...uvsgamesJobs.backfill(
    "meta.uvsgames_backfill",
    backfillCatalog,
    isCatalogSyncNoop,
    resumeFromInstant,
  ),
  autoAccept: uvsgamesJobs.job(
    "meta.uvsgames_auto_accept",
    autoAcceptCatalogBacklog,
    isAutoAcceptNoop,
  ),
  recheck: uvsgamesJobs.job(
    "meta.uvsgames_recheck",
    (deps, runId) => processRechecks(deps, { runId, listing: true }),
    isRecheckNoop,
  ),
  // Five upstream requests at 30s each outlive the proxy's read timeout: the
  // gateway 405s the dead POST, but the run keeps going and reports its runId.
  fetchEvent: uvsgamesJobs.eventFetch("meta.uvsgames_event_fetch", fetchEventNow),
} satisfies CatalogSource<
  CatalogQuery<"dismiss">,
  string,
  UvsgamesListRow,
  MetaSyncDeps,
  CatalogQuery<"list">
>;

const playloltcgJobs = sourceJobs(playloltcgDeps);

const PLAYLOLTCG = {
  provider: PLAYLOLTCG_PROVIDER,
  keyOf: (input) => input.activityShopId,
  byKey: (repos, key) => repos.playloltcgEvents.byKey(key),
  parseKey: (key) => {
    const id = Number(key);
    return Number.isSafeInteger(id) ? id : undefined;
  },
  keyText: String,
  deps: playloltcgDeps,
  accept: (deps, row) => acceptPlayloltcgEvent(deps, row),
  list: catalogList({
    events: (repos: Repos) => repos.playloltcgEvents,
    filters: (query: CatalogQuery<"playloltcgList">, bucket) => ({
      search: query.search,
      triage: query.triage,
      status: query.status,
      minPlayers: query.minPlayers,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      missing: query.missing,
      bucket,
    }),
    presenter: () => Promise.resolve(toPlayloltcgCatalogRow),
  }),
  sync: scheduledJob("meta.playloltcg_sync"),
  ...playloltcgJobs.backfill(
    "meta.playloltcg_backfill",
    backfillPlayloltcg,
    isPlayloltcgSyncNoop,
    resumeFromInstant,
  ),
  autoAccept: playloltcgJobs.job(
    "meta.playloltcg_auto_accept",
    autoAcceptPlayloltcgBacklog,
    isAutoAcceptNoop,
  ),
  recheck: playloltcgJobs.job(
    "meta.playloltcg_recheck",
    (deps, runId) => processPlayloltcgRechecks(deps, { runId, listing: true }),
    isPlayloltcgRecheckNoop,
  ),
  fetchEvent: playloltcgJobs.eventFetch("meta.playloltcg_event_fetch", (deps, row) =>
    fetchPlayloltcgEvent(deps, row),
  ),
} satisfies CatalogSource<
  CatalogQuery<"playloltcgDismiss">,
  number,
  PlayloltcgListRow,
  PlayloltcgSyncDeps,
  CatalogQuery<"playloltcgList">
>;

const topdeckJobs = sourceJobs(topdeckDeps);

const TOPDECK = {
  provider: TOPDECK_PROVIDER,
  keyOf: (input) => input.tid,
  byKey: (repos, key) => repos.topdeckEvents.byKey(key),
  parseKey: (key) => key,
  keyText: (key) => key,
  deps: topdeckDeps,
  accept: (deps, row) => acceptTopdeckEvent(deps, row),
  list: catalogList({
    events: (repos: Repos) => repos.topdeckEvents,
    filters: (query: CatalogQuery<"topdeckList">, bucket) => ({
      search: query.search,
      triage: query.triage,
      format: query.format,
      minPlayers: query.minPlayers,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      missing: query.missing,
      bucket,
    }),
    presenter: () => Promise.resolve(toTopdeckCatalogRow),
  }),
  sync: scheduledJob("meta.topdeck_sync"),
  ...topdeckJobs.backfill(
    "meta.topdeck_backfill",
    backfillTopdeck,
    isTopdeckSyncNoop,
    resumeFromInstant,
  ),
  autoAccept: topdeckJobs.job(
    "meta.topdeck_auto_accept",
    autoAcceptTopdeckBacklog,
    isAutoAcceptNoop,
  ),
} satisfies CatalogSource<
  CatalogQuery<"topdeckDismiss">,
  string,
  TopdeckListRow,
  TopdeckSyncDeps,
  CatalogQuery<"topdeckList">
>;

const playriftboundJobs = sourceJobs(playriftboundDeps);

const PLAYRIFTBOUND = {
  provider: PLAYRIFTBOUND_PROVIDER,
  keyOf: (input) => input.tournamentId,
  byKey: (repos, key) => repos.playriftboundEvents.byKey(key),
  parseKey: (key) => key,
  keyText: (key) => key,
  deps: playriftboundDeps,
  accept: (deps, row) => acceptPlayriftboundEvent(deps, row),
  list: catalogList({
    events: (repos: Repos) => repos.playriftboundEvents,
    filters: (query: CatalogQuery<"playriftboundList">, bucket) => ({
      search: query.search,
      triage: query.triage,
      tournamentType: query.tournamentType,
      format: query.format,
      minPlayers: query.minPlayers,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      missing: query.missing,
      bucket,
    }),
    presenter: () => Promise.resolve(toPlayriftboundCatalogRow),
  }),
  sync: scheduledJob("meta.playriftbound_sync"),
  // The checkpoint here is a cell index.
  ...playriftboundJobs.backfill(
    "meta.playriftbound_backfill",
    backfillPlayriftbound,
    isPlayriftboundSyncNoop,
    resumeFromCell,
  ),
  autoAccept: playriftboundJobs.job(
    "meta.playriftbound_auto_accept",
    autoAcceptPlayriftboundBacklog,
    isAutoAcceptNoop,
  ),
  recheck: playriftboundJobs.job(
    "meta.playriftbound_recheck",
    (deps, runId) => processPlayriftboundRechecks(deps, { runId, rearm: true }),
    isPlayriftboundRecheckNoop,
  ),
  fetchEvent: playriftboundJobs.eventFetch("meta.playriftbound_event_fetch", (deps, row) =>
    fetchPlayriftboundEvent(deps, row),
  ),
} satisfies CatalogSource<
  CatalogQuery<"playriftboundDismiss">,
  string,
  PlayriftboundListRow,
  PlayriftboundSyncDeps,
  CatalogQuery<"playriftboundList">
>;

async function requireMirrored<TKey, TRow extends MirroredEvent, TDeps>(
  source: MirrorEvents<TKey, TRow, TDeps>,
  context: ApiContext,
  key: TKey,
): Promise<TRow> {
  const row = await source.byKey(context.repos, key);
  assertFound(row, "Mirrored event not found");
  return row;
}

function alreadyTriaged(): AppError {
  return new AppError(409, ERROR_CODES.CONFLICT, "This event is already published or dismissed.");
}

async function claimAccept<TRow extends MirroredEvent, TDeps>(
  source: Pick<MirrorEvents<unknown, TRow, TDeps>, "provider" | "deps" | "accept">,
  context: ApiContext,
  row: TRow,
  keyText: string,
  options: AcceptOptions,
): Promise<AcceptedEvent | null> {
  return await context.repos.meta.withPromoteLock(
    `source:${source.provider}:${keyText}`,
    async (locked) => {
      if (!(await locked.meta.sourceKeyUntriaged(source.provider, keyText))) {
        return null;
      }
      return await source.accept(source.deps({ ...context, repos: locked }), row, options);
    },
  );
}

function claimDismiss(context: ApiContext, provider: string, keyText: string): Promise<boolean> {
  return context.repos.meta.withPromoteLock(`source:${provider}:${keyText}`, (locked) =>
    locked.metaOverlays.claimIgnoreEvent(provider, keyText),
  );
}

async function acceptMirrored<TKey, TRow extends MirroredEvent, TDeps>(
  source: MirrorEvents<TKey, TRow, TDeps>,
  context: AuthedContext,
  key: TKey,
  options: AcceptOptions = {},
): Promise<AcceptedEvent> {
  const row = await requireMirrored(source, context, key);
  if (row.triage !== "new") {
    throw alreadyTriaged();
  }
  const accepted = await claimAccept(source, context, row, source.keyText(key), options);
  if (accepted === null) {
    throw alreadyTriaged();
  }
  await recordAdminEvent(context.repos, context.userId, {
    action: "meta-catalog.accept",
    entityType: "meta-catalog",
    entityId: `${source.provider}:${source.keyText(key)}`,
    entityLabel: row.name,
    newValues: { metaEventId: accepted.metaEventId, slug: accepted.slug },
  });
  return accepted;
}

async function dismissMirrored<TKey, TRow extends MirroredEvent, TDeps>(
  source: MirrorEvents<TKey, TRow, TDeps>,
  context: AuthedContext,
  key: TKey,
): Promise<void> {
  const row = await requireMirrored(source, context, key);
  const externalId = source.keyText(key);
  if (row.triage !== "new" || !(await claimDismiss(context, source.provider, externalId))) {
    throw alreadyTriaged();
  }
  await recordAdminEvent(context.repos, context.userId, {
    action: "meta-catalog.dismiss",
    entityType: "meta-catalog",
    entityId: `${source.provider}:${externalId}`,
    entityLabel: row.name,
  });
}

async function undismissMirrored<TKey>(
  source: { provider: string; keyText: (key: TKey) => string },
  context: AuthedContext,
  key: TKey,
): Promise<void> {
  const externalId = source.keyText(key);
  const removed = await context.repos.metaOverlays.unignoreEvent(source.provider, externalId);
  assertExisted(removed, "Ignore entry not found");
  await recordAdminEvent(context.repos, context.userId, {
    action: "meta-catalog.undismiss",
    entityType: "meta-catalog",
    entityId: `${source.provider}:${externalId}`,
  });
}

function eventHandlers<TKeyInput, TKey, TRow extends MirroredEvent, TDeps>(
  source: MirrorEvents<TKey, TRow, TDeps> & { keyOf: (input: TKeyInput) => TKey },
) {
  return {
    accept: ({ input, context }: { input: TKeyInput; context: AuthedContext }) =>
      acceptMirrored(source, context, source.keyOf(input)),
    dismiss: ({ input, context }: { input: TKeyInput; context: AuthedContext }) =>
      dismissMirrored(source, context, source.keyOf(input)),
    undismiss: ({ input, context }: { input: TKeyInput; context: AuthedContext }) =>
      undismissMirrored(source, context, source.keyOf(input)),
  };
}

function fetchHandler<TKeyInput, TKey, TRow extends MirroredEvent, TDeps>(
  source: MirrorEvents<TKey, TRow, TDeps> & {
    keyOf: (input: TKeyInput) => TKey;
    fetchEvent: (context: ApiContext, row: TRow) => Promise<MetaSyncTriggerResult>;
  },
) {
  return async ({ input, context }: { input: TKeyInput; context: ApiContext }) => {
    const row = await requireMirrored(source, context, source.keyOf(input));
    if (row.metaEventId === null) {
      throw new AppError(
        400,
        ERROR_CODES.BAD_REQUEST,
        "Publish this event before collecting its results.",
      );
    }
    return await source.fetchEvent(context, row);
  };
}

const uvsgames = eventHandlers(UVSGAMES);
const playloltcg = eventHandlers(PLAYLOLTCG);
const topdeck = eventHandlers(TOPDECK);
const playriftbound = eventHandlers(PLAYRIFTBOUND);

interface MirrorRowHandle {
  triage: string;
  metaEventId: string | null;
  publish: () => Promise<AcceptedEvent | null>;
  dismiss: () => Promise<boolean>;
}

interface MirrorAccess {
  provider: string;
  row: (context: ApiContext, key: string) => Promise<MirrorRowHandle | undefined>;
}

function mirrorAccess<TKey, TRow extends MirroredEvent, TDeps>(
  source: MirrorEvents<TKey, TRow, TDeps>,
): MirrorAccess {
  return {
    provider: source.provider,
    row: async (context, key) => {
      const parsed = source.parseKey(key);
      const row = parsed === undefined ? undefined : await source.byKey(context.repos, parsed);
      return (
        row && {
          triage: row.triage,
          metaEventId: row.metaEventId,
          publish: () => claimAccept(source, context, row, source.keyText(parsed as TKey), {}),
          dismiss: () => claimDismiss(context, source.provider, source.keyText(parsed as TKey)),
        }
      );
    },
  };
}

export const MIRRORS: Record<MetaSource, MirrorAccess> = {
  uvsgames: mirrorAccess(UVSGAMES),
  playloltcg: mirrorAccess(PLAYLOLTCG),
  topdeck: mirrorAccess(TOPDECK),
  playriftbound: mirrorAccess(PLAYRIFTBOUND),
};

/**
 * Accept and dismiss are the only two writes against a catalogue row, and
 * neither edits the mirror: accept mints the live event and promotes it,
 * dismiss writes the ignore key the ingest already honours.
 */
export const adminMetaCatalogSourcesRouter = {
  list: os.list.handler(UVSGAMES.list),

  accept: os.accept.handler(({ input, context }) =>
    acceptMirrored(UVSGAMES, context, input.externalId, { format: input.format }),
  ),

  dismiss: os.dismiss.handler(uvsgames.dismiss),

  undismiss: os.undismiss.handler(uvsgames.undismiss),

  runSync: os.runSync.handler(UVSGAMES.sync),

  runBackfill: os.runBackfill.handler(UVSGAMES.backfill),

  restartBackfill: os.restartBackfill.handler(UVSGAMES.restartBackfill),

  runRecheck: os.runRecheck.handler(UVSGAMES.recheck),

  runAutoAccept: os.runAutoAccept.handler(UVSGAMES.autoAccept),

  fetchEvent: os.fetchEvent.handler(fetchHandler(UVSGAMES)),

  runPlayloltcgSync: os.runPlayloltcgSync.handler(PLAYLOLTCG.sync),
  runPlayloltcgRecheck: os.runPlayloltcgRecheck.handler(PLAYLOLTCG.recheck),
  runPlayloltcgBackfill: os.runPlayloltcgBackfill.handler(PLAYLOLTCG.backfill),
  restartPlayloltcgBackfill: os.restartPlayloltcgBackfill.handler(PLAYLOLTCG.restartBackfill),
  runPlayloltcgAutoAccept: os.runPlayloltcgAutoAccept.handler(PLAYLOLTCG.autoAccept),
  playloltcgList: os.playloltcgList.handler(PLAYLOLTCG.list),
  playloltcgAccept: os.playloltcgAccept.handler(playloltcg.accept),
  playloltcgDismiss: os.playloltcgDismiss.handler(playloltcg.dismiss),
  playloltcgUndismiss: os.playloltcgUndismiss.handler(playloltcg.undismiss),
  playloltcgFetchEvent: os.playloltcgFetchEvent.handler(fetchHandler(PLAYLOLTCG)),

  runTopdeckSync: os.runTopdeckSync.handler(TOPDECK.sync),
  runTopdeckBackfill: os.runTopdeckBackfill.handler(TOPDECK.backfill),
  restartTopdeckBackfill: os.restartTopdeckBackfill.handler(TOPDECK.restartBackfill),
  runTopdeckAutoAccept: os.runTopdeckAutoAccept.handler(TOPDECK.autoAccept),
  topdeckList: os.topdeckList.handler(TOPDECK.list),
  topdeckAccept: os.topdeckAccept.handler(topdeck.accept),
  topdeckDismiss: os.topdeckDismiss.handler(topdeck.dismiss),
  topdeckUndismiss: os.topdeckUndismiss.handler(topdeck.undismiss),

  runPlayriftboundSync: os.runPlayriftboundSync.handler(PLAYRIFTBOUND.sync),
  runPlayriftboundRecheck: os.runPlayriftboundRecheck.handler(PLAYRIFTBOUND.recheck),
  runPlayriftboundBackfill: os.runPlayriftboundBackfill.handler(PLAYRIFTBOUND.backfill),
  restartPlayriftboundBackfill: os.restartPlayriftboundBackfill.handler(
    PLAYRIFTBOUND.restartBackfill,
  ),
  runPlayriftboundAutoAccept: os.runPlayriftboundAutoAccept.handler(PLAYRIFTBOUND.autoAccept),
  playriftboundList: os.playriftboundList.handler(PLAYRIFTBOUND.list),
  playriftboundAccept: os.playriftboundAccept.handler(playriftbound.accept),
  playriftboundDismiss: os.playriftboundDismiss.handler(playriftbound.dismiss),
  playriftboundUndismiss: os.playriftboundUndismiss.handler(playriftbound.undismiss),
  playriftboundFetchEvent: os.playriftboundFetchEvent.handler(fetchHandler(PLAYRIFTBOUND)),
};
