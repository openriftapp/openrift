import { DAY_MS, HOUR_MS, formatDay, utcDayDiff } from "@openrift/shared/format-date";
import { errorMessage } from "@openrift/shared/strings";

import { recordCapped } from "../../../../lib/json-coerce.js";
import { PLAYLOLTCG_STATUS_FINISHED } from "../../../../lib/meta-providers.js";
import { shiftDays } from "../../lib/meta-durations.js";
import {
  DECKLIST_PUBLISHED,
  firstRevisit,
  lifecycleStatus,
  nextRecheck,
} from "../../lib/meta-recheck-schedule.js";
import {
  PLAYLOLTCG_STATUS_IN_PROGRESS,
  projectEventRow,
  projectShopRow,
} from "../../lib/playloltcg-catalog.js";
import type {
  PlayloltcgListRow,
  PlayloltcgRecheckRow,
  PlayloltcgUpsertInput,
} from "../../repositories/playloltcg-events.js";
import { createCrawlRun } from "./crawl-run.js";
import { clock } from "./deps.js";
import { autoAcceptPlayloltcgEvents } from "./playloltcg-accept.js";
import { MAX_PAGE_SIZE } from "./playloltcg-client.js";
import type { PlayloltcgDeepFetchResult, PlayloltcgDetailFacts } from "./playloltcg-deep-fetch.js";
import { playloltcgDeepFetch, readPlayloltcgDetail } from "./playloltcg-deep-fetch.js";
import type { PlayloltcgSyncDeps } from "./playloltcg-deps.js";
import type { RecheckPassResult, VisitOutcome } from "./recheck-pass.js";
import { emptyRecheckPassResult, runRecheckPass } from "./recheck-pass.js";
import type { MetaSyncResultBase } from "./result.js";
import { emptyMetaSyncResult } from "./result.js";
import { createRunHeartbeat } from "./run-heartbeat.js";
import { isTransientSourceFailure, sourceStopOf } from "./source-http.js";
import type { SourceStopFields } from "./source-stop.js";
import { applySourceStop } from "./source-stop.js";
import { isRecheckPassNoop, isSyncNoop } from "./sync-noop.js";

const EVENTS_PATH = "/xcx/activityShop/page";
const SHOPS_PATH = "/xcx/shop/searchShop";

const SYNC_LOOKBACK_DAYS = 7;
const RECENT_LISTING_DAYS = 3;
const FUTURE_HORIZON_DAYS = 730;
const BACKFILL_CHUNK_DAYS = 14;
const ARCHIVE_START = new Date("2025-06-01T00:00:00Z");

const BLOCKED_EVENT_DEFER_MS = 24 * HOUR_MS;

const PLAYLOLTCG_RECHECK_BUDGET_MS = 5 * 60 * 1000;

// The WAF blocked the IP at 15-25k requests a day; this caps a day near 8.6k.
const PLAYLOLTCG_RUN_REQUESTS = 60;

const MIN_DECKS_PER_VISIT = 20;

const RECHECK_PAGE_SIZE = 50;

const DECK_CONTINUE_MS = 60 * 1000;

export interface PlayloltcgSyncResult extends MetaSyncResultBase, SourceStopFields {
  shops: number;
}

function emptyResult(): PlayloltcgSyncResult {
  return {
    ...emptyMetaSyncResult(),
    shops: 0,
    blocked: false,
    blockedUntil: null,
    pausedUntil: null,
  };
}

export function isPlayloltcgSyncNoop(result: PlayloltcgSyncResult): boolean {
  return isSyncNoop(result);
}

export interface PlayloltcgRecheckResult extends RecheckPassResult {
  fetched: number;
  players: number;
  decks: number;
  acceptedPlayers: number;
  listed: number | null;
  pulledForward: number;
}

export interface PlayloltcgRecheckOptions {
  /** Wall-clock milliseconds; the pass stops between two events once it is spent. */
  budgetMs?: number;
  listing?: boolean;
  runId?: string;
}

export function isPlayloltcgRecheckNoop(result: PlayloltcgRecheckResult): boolean {
  return isRecheckPassNoop(result);
}

function day(date: Date): string {
  return formatDay(date);
}

function absorbStop(
  deps: PlayloltcgSyncDeps,
  result: SourceStopFields & { errors: string[] },
  now: Date,
  error: unknown,
): boolean {
  const stop = sourceStopOf(error);
  if (stop !== null) {
    deps.log.warn({ err: error }, "playloltcg stopped the run");
    recordCapped(result.errors, [applySourceStop(result, stop, now, error)]);
    return true;
  }
  if (isTransientSourceFailure(error)) {
    recordCapped(result.errors, [`Stopped: ${errorMessage(error)}`]);
    return true;
  }
  return false;
}

/**
 * The source caps a page at {@link MAX_PAGE_SIZE} and sorts oldest day last:
 * a full page means a gap at the window's start, not its end.
 */
async function crawlWindow(
  deps: PlayloltcgSyncDeps,
  result: PlayloltcgSyncResult,
  from: Date,
  to: Date,
  seenAt: Date,
  touched: number[],
): Promise<void> {
  const body = await deps.client.postList<unknown>(EVENTS_PATH, {
    pageNum: 1,
    pageSize: MAX_PAGE_SIZE,
    searchContent: "",
    battleMode: "",
    isSubmitCardGroup: "",
    sortWeight: "",
    userLocation: {},
    startTime: day(from),
    endTime: day(to),
  });
  result.rows += body.items.length;
  const projections: PlayloltcgUpsertInput[] = [];
  for (const raw of body.items) {
    const projection = projectEventRow(raw);
    if (projection !== null) {
      projections.push(projection);
    }
  }
  const written = await deps.repos.playloltcgEvents.upsertBatch(projections, seenAt);
  result.inserted += written.inserted.length;
  result.changed += written.changed.length;
  result.unchanged += written.unchanged.length;
  touched.push(...written.inserted, ...written.changed);

  if (body.items.length < MAX_PAGE_SIZE) {
    return;
  }
  const days = utcDayDiff(from, to) ?? 0;
  if (days < 1) {
    result.complete = false;
    recordCapped(result.errors, [
      `${day(from)} alone returned ${MAX_PAGE_SIZE} rows, which is all the source will give for one query, so part of that day was not read.`,
    ]);
    return;
  }
  const mid = shiftDays(from, Math.floor(days / 2));
  await crawlWindow(deps, result, from, mid, seenAt, touched);
  await crawlWindow(deps, result, shiftDays(mid, 1), to, seenAt, touched);
}

async function syncShops(deps: PlayloltcgSyncDeps, result: PlayloltcgSyncResult): Promise<void> {
  const body = await deps.client.postList<unknown>(SHOPS_PATH, {
    pageNum: 1,
    pageSize: MAX_PAGE_SIZE,
    name: "",
    lon: 116.4,
    lat: 39.9,
  });
  const shops = body.items.map((raw) => projectShopRow(raw)).filter((s) => s !== null);
  result.shops = await deps.repos.playloltcgEvents.upsertShops(shops);
  if (body.items.length >= MAX_PAGE_SIZE) {
    result.complete = false;
    recordCapped(result.errors, [
      `The store registry filled a ${MAX_PAGE_SIZE}-row page, so it is no longer one call and the directory is incomplete.`,
    ]);
  }
}

async function finish(
  deps: PlayloltcgSyncDeps,
  result: PlayloltcgSyncResult,
  touched: number[],
): Promise<void> {
  const auto = await autoAcceptPlayloltcgEvents(deps, [...new Set(touched)]);
  result.autoAccepted = auto.accepted;
  result.autoHeld = auto.held;
  recordCapped(result.errors, auto.errors);
  result.requests = deps.client.requests;
}

export async function syncPlayloltcgCatalog(
  deps: PlayloltcgSyncDeps,
): Promise<PlayloltcgSyncResult> {
  const result = emptyResult();
  const now = clock(deps);
  const from = shiftDays(now, -SYNC_LOOKBACK_DAYS);
  const touched: number[] = [];
  try {
    await syncShops(deps, result);
    await crawlWindow(deps, result, from, shiftDays(now, FUTURE_HORIZON_DAYS), now, touched);
    // A gap in coverage looks identical to a row the source stopped listing, so
    // only a run that covered the whole window may mark a stored row missing.
    if (result.complete) {
      result.missing = await deps.repos.playloltcgEvents.markMissing({
        from: day(from),
        to: day(now),
        seenBefore: now,
        at: now,
      });
    }
  } catch (error) {
    if (!absorbStop(deps, result, now, error)) {
      throw error;
    }
    result.complete = false;
  }
  await finish(deps, result, touched);
  return result;
}

/** Advances the ladder on neither success nor decay: that would either decay a finished event's revisits or rewind a completed one to the event-day poll. */
async function grace(
  deps: PlayloltcgSyncDeps,
  activityShopId: number,
  now: Date,
  checkStage: number,
): Promise<void> {
  await deps.repos.playloltcgEvents.setRecheck(activityShopId, {
    nextCheckAt: new Date(now.getTime() + HOUR_MS),
    checkStage,
  });
}

/** Holds the ladder: advancing it while decks are still owed left large fields permanently short. */
async function resumeSoon(
  deps: PlayloltcgSyncDeps,
  activityShopId: number,
  now: Date,
  checkStage: number,
): Promise<void> {
  await deps.repos.playloltcgEvents.setRecheck(activityShopId, {
    nextCheckAt: new Date(now.getTime() + DECK_CONTINUE_MS),
    checkStage,
  });
}

function displayStatusOf(detail: PlayloltcgDetailFacts, status: number | null): string {
  if (detail.isPublishResult || status === PLAYLOLTCG_STATUS_FINISHED) {
    return "complete";
  }
  return status === PLAYLOLTCG_STATUS_IN_PROGRESS ? "inProgress" : "upcoming";
}

function startInstant(startAt: string | null, fallback: Date): Date {
  return startAt === null ? fallback : new Date(`${startAt}T00:00:00Z`);
}

async function refreshRecentListing(
  deps: PlayloltcgSyncDeps,
  now: Date,
  result: PlayloltcgRecheckResult,
): Promise<void> {
  const listing = emptyResult();
  const touched: number[] = [];
  await crawlWindow(deps, listing, shiftDays(now, -RECENT_LISTING_DAYS), now, now, touched);
  const unique = [...new Set(touched)];
  const auto = await autoAcceptPlayloltcgEvents(deps, unique);
  result.listed = listing.rows;
  result.pulledForward = await deps.repos.playloltcgEvents.pullForwardRechecks(unique, now);
  recordCapped(
    result.errors,
    [...listing.errors, ...auto.errors].map((message) => `Listing: ${message}`),
  );
}

/** Five failed visits in a row end the run and pause the next ones for half an hour. */
export async function processPlayloltcgRechecks(
  deps: PlayloltcgSyncDeps,
  options: PlayloltcgRecheckOptions = {},
): Promise<PlayloltcgRecheckResult> {
  const { budgetMs = PLAYLOLTCG_RECHECK_BUDGET_MS } = options;
  const now = clock(deps);
  const result: PlayloltcgRecheckResult = {
    ...emptyRecheckPassResult(),
    fetched: 0,
    players: 0,
    decks: 0,
    acceptedPlayers: 0,
    listed: null,
    pulledForward: 0,
  };
  return await runRecheckPass({
    result,
    heartbeat: createRunHeartbeat(deps, options.runId),
    log: deps.log,
    now: () => clock(deps),
    budgetMs,
    requests: () => deps.client.requests,
    maxRequests: PLAYLOLTCG_RUN_REQUESTS,
    pageSize: RECHECK_PAGE_SIZE,
    prepare: async () => {
      if (options.listing === true) {
        await refreshRecentListing(deps, now, result);
      }
    },
    due: (at, limit) => deps.repos.playloltcgEvents.dueForRecheck(at, limit),
    keyOf: (row) => row.activityShopId,
    visit: (row, at, spent) =>
      visitPlayloltcgEvent(
        deps,
        row,
        at,
        result,
        Math.max(MIN_DECKS_PER_VISIT, PLAYLOLTCG_RUN_REQUESTS - spent),
      ),
    grace: (row, at) => grace(deps, row.activityShopId, at, row.checkStage),
    drop: (row) =>
      deps.repos.playloltcgEvents.setRecheck(row.activityShopId, {
        nextCheckAt: null,
        checkStage: row.checkStage,
      }),
    stopOf: sourceStopOf,
    deferOnStop: async (row, stop, at) => {
      if (stop === "block") {
        await deps.repos.playloltcgEvents.setRecheck(row.activityShopId, {
          nextCheckAt: new Date(at.getTime() + BLOCKED_EVENT_DEFER_MS),
          checkStage: row.checkStage,
        });
      }
    },
  });
}

async function visitPlayloltcgEvent(
  deps: PlayloltcgSyncDeps,
  row: PlayloltcgRecheckRow,
  now: Date,
  result: PlayloltcgRecheckResult,
  deckBudget: number,
): Promise<VisitOutcome> {
  const detailErrors: string[] = [];
  const detail = await readPlayloltcgDetail(deps, row.activityShopId, detailErrors, {
    rethrowRefusal: true,
  });
  recordCapped(result.errors, detailErrors);
  if (detail === null) {
    await grace(deps, row.activityShopId, now, row.checkStage);
    return "failed";
  }
  if (detail.shopId !== null) {
    await deps.repos.playloltcgEvents.linkShopFromDetail(row.activityShopId, {
      id: detail.shopId,
      name: detail.shopName ?? row.shopName ?? String(detail.shopId),
    });
  }
  const coverage = await deps.repos.playloltcgResults.deckCoverage(row.activityShopId);
  // isPublishResult means both results and decklists are final: the source
  // publishes them together.
  const displayStatus = displayStatusOf(detail, row.status);
  const startAt = startInstant(row.startAt, now);
  const decision = nextRecheck({
    now,
    checkStage: row.checkStage,
    displayStatus,
    startAt,
    decklistStatus: detail.isPublishResult ? DECKLIST_PUBLISHED : null,
    fetched: row.fetchedAt !== null,
    decksComplete: coverage.outstanding.length === 0,
    playersPending: false,
    // The source publishes results only with the finished event.
    newRounds: false,
    watched: false,
    important: row.important,
  });
  if (row.metaEventId !== null) {
    await deps.repos.meta.setEventLifecycle(row.metaEventId, {
      status: lifecycleStatus({ now, displayStatus, startAt }),
      sourceCheckedAt: now,
    });
  }
  const advance = () =>
    deps.repos.playloltcgEvents.setRecheck(row.activityShopId, {
      nextCheckAt: decision.nextCheckAt,
      checkStage: decision.checkStage,
    });

  if (!decision.deepFetch) {
    await advance();
    result.processed++;
    return "ok";
  }

  const fetched = await playloltcgDeepFetch(deps, row, detail, deckBudget);
  result.fetched++;
  result.players += fetched.players;
  result.decks += fetched.decks;
  result.acceptedPlayers += fetched.acceptedPlayers;
  recordCapped(result.errors, fetched.errors);
  if (!fetched.complete) {
    await grace(deps, row.activityShopId, now, row.checkStage);
    return "failed";
  }
  await (fetched.decksRemaining > 0
    ? resumeSoon(deps, row.activityShopId, now, row.checkStage)
    : advance());
  result.processed++;
  return "ok";
}

/** A manual fetch of published results counts as the event's first finished visit. */
export async function fetchPlayloltcgEvent(
  deps: PlayloltcgSyncDeps,
  row: PlayloltcgListRow,
): Promise<PlayloltcgDeepFetchResult> {
  const errors: string[] = [];
  const detail = await readPlayloltcgDetail(deps, row.activityShopId, errors);
  if (detail === null) {
    return {
      activityShopId: row.activityShopId,
      requests: deps.client.requests,
      players: 0,
      decks: 0,
      deckRequests: 0,
      decksRemaining: 0,
      acceptedPlayers: 0,
      skippedPlayers: 0,
      shopId: null,
      publishedResults: false,
      complete: false,
      errors,
    };
  }
  // Unbounded: this runs as a tracked background job, and stopping partway
  // would answer "what does the source hold" with half of it.
  const result = await playloltcgDeepFetch(deps, row, detail, Number.POSITIVE_INFINITY);
  if (
    result.complete &&
    result.publishedResults &&
    row.nextCheckAt !== null &&
    row.checkStage === 0
  ) {
    await deps.repos.playloltcgEvents.setRecheck(row.activityShopId, firstRevisit(clock(deps)));
  }
  return { ...result, errors: [...errors, ...result.errors] };
}

export interface PlayloltcgBackfillOptions {
  resumeFrom?: Date;
}

/** Checkpoints per chunk, so a block resumes from the last day covered. */
export async function backfillPlayloltcg(
  deps: PlayloltcgSyncDeps,
  runId?: string,
  options: PlayloltcgBackfillOptions = {},
): Promise<PlayloltcgSyncResult> {
  const result = emptyResult();
  const now = clock(deps);
  const to = shiftDays(now, FUTURE_HORIZON_DAYS);
  const resumeFrom = options.resumeFrom;
  let from = resumeFrom === undefined ? ARCHIVE_START : new Date(resumeFrom.getTime() + DAY_MS);
  if (resumeFrom !== undefined) {
    result.resumedFrom = resumeFrom.toISOString();
    result.coveredThrough = day(resumeFrom);
  }
  const touched: number[] = [];
  const run = createCrawlRun({
    result,
    heartbeat: createRunHeartbeat(deps, runId),
    requests: () => deps.client.requests,
  });
  try {
    await syncShops(deps, result);
    while (from.getTime() <= to.getTime()) {
      if (!(await run.tick())) {
        break;
      }
      const chunkTo = shiftDays(from, BACKFILL_CHUNK_DAYS - 1);
      const windowTo = chunkTo.getTime() > to.getTime() ? to : chunkTo;
      await crawlWindow(deps, result, from, windowTo, now, touched);
      result.coveredThrough = day(windowTo);
      from = shiftDays(windowTo, 1);
    }
  } catch (error) {
    if (!absorbStop(deps, result, now, error)) {
      throw error;
    }
    result.complete = false;
  }
  await finish(deps, result, touched);
  return result;
}
