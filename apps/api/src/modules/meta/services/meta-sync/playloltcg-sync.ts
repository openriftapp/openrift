import { PLAYLOLTCG_STATUS_FINISHED } from "../../../../lib/meta-providers.js";
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
import { runCancelRequested, writeRunHeartbeat } from "./crawl-checkpoint.js";
import { errorText } from "./deps.js";
import { autoAcceptPlayloltcgEvents } from "./playloltcg-accept.js";
import { MAX_PAGE_SIZE, PlayloltcgBlockedError } from "./playloltcg-client.js";
import type { PlayloltcgDeepFetchResult, PlayloltcgDetailFacts } from "./playloltcg-deep-fetch.js";
import { playloltcgDeepFetch, readPlayloltcgDetail } from "./playloltcg-deep-fetch.js";
import type { PlayloltcgSyncDeps } from "./playloltcg-deps.js";
import { clock } from "./playloltcg-deps.js";
import type { MetaSyncResultBase } from "./result.js";
import { emptyMetaSyncResult } from "./result.js";

const EVENTS_PATH = "/xcx/activityShop/page";
const SHOPS_PATH = "/xcx/shop/searchShop";

const DAY_MS = 24 * 60 * 60 * 1000;
const SYNC_LOOKBACK_DAYS = 7;
const RECENT_LISTING_DAYS = 3;
const FUTURE_HORIZON_DAYS = 730;
const BACKFILL_CHUNK_DAYS = 14;
const ARCHIVE_START = new Date("2025-06-01T00:00:00Z");

const COOLDOWN_HOURS = 6;
const HOUR_MS = 60 * 60 * 1000;
const BACKOFF_MS = 30 * 60 * 1000;
const BLOCKED_EVENT_DEFER_MS = 24 * HOUR_MS;

const MAX_ERRORS = 50;

const PLAYLOLTCG_RECHECK_BUDGET_MS = 5 * 60 * 1000;

// The WAF blocked the IP at 15-25k requests a day; this caps a day near 8.6k.
const PLAYLOLTCG_RUN_REQUESTS = 60;

const MIN_DECKS_PER_VISIT = 20;

const RECHECK_PAGE_SIZE = 50;

const MAX_FAILED_VISITS_IN_A_ROW = 5;

const DECK_CONTINUE_MS = 60 * 1000;

export interface PlayloltcgSyncResult extends MetaSyncResultBase {
  shops: number;
  blocked: boolean;
  blockedUntil: string | null;
}

function emptyResult(): PlayloltcgSyncResult {
  return { ...emptyMetaSyncResult(), shops: 0, blocked: false, blockedUntil: null };
}

export function isPlayloltcgSyncNoop(result: PlayloltcgSyncResult): boolean {
  return (
    result.inserted === 0 &&
    result.changed === 0 &&
    result.missing === 0 &&
    result.autoAccepted === 0 &&
    !result.blocked
  );
}

export interface PlayloltcgRecheckResult {
  due: number;
  processed: number;
  requests: number;
  fetched: number;
  players: number;
  decks: number;
  acceptedPlayers: number;
  listed: number | null;
  pulledForward: number;
  backedOff: boolean;
  blocked: boolean;
  blockedUntil: string | null;
  errors: string[];
}

export interface PlayloltcgRecheckOptions {
  /** Wall-clock milliseconds; the pass stops between two events once it is spent. */
  budgetMs?: number;
  listing?: boolean;
}

export function isPlayloltcgRecheckNoop(result: PlayloltcgRecheckResult): boolean {
  return (
    result.processed === 0 &&
    result.pulledForward === 0 &&
    !result.blocked &&
    result.errors.length === 0
  );
}

function day(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shift(from: Date, days: number): Date {
  return new Date(from.getTime() + days * DAY_MS);
}

function cooldownUntil(now: Date): string {
  return new Date(now.getTime() + COOLDOWN_HOURS * HOUR_MS).toISOString();
}

/** Caps collected errors so a failing run can't fill `job_runs`. */
function record(errors: string[], messages: readonly string[]): void {
  for (const message of messages) {
    if (errors.length >= MAX_ERRORS) {
      return;
    }
    errors.push(message);
  }
}

export async function playloltcgCoolingDown(
  deps: PlayloltcgSyncDeps,
  kind: string,
  now: Date,
): Promise<boolean> {
  const prior = await deps.repos.jobRuns.findLatestForResume(kind);
  const result = prior?.result as { blockedUntil?: unknown } | null | undefined;
  const until = result?.blockedUntil;
  return typeof until === "string" && new Date(until).getTime() > now.getTime();
}

function markBlocked(
  deps: PlayloltcgSyncDeps,
  result: PlayloltcgSyncResult,
  now: Date,
  error: PlayloltcgBlockedError,
): void {
  deps.log.warn({ err: error }, "playloltcg WAF block");
  result.blocked = true;
  result.complete = false;
  result.blockedUntil = cooldownUntil(now);
  record(result.errors, [error.message]);
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
  const days = Math.round((to.getTime() - from.getTime()) / DAY_MS);
  if (days < 1) {
    result.complete = false;
    record(result.errors, [
      `${day(from)} alone returned ${MAX_PAGE_SIZE} rows, which is all the source will give for one query, so part of that day was not read.`,
    ]);
    return;
  }
  const mid = shift(from, Math.floor(days / 2));
  await crawlWindow(deps, result, from, mid, seenAt, touched);
  await crawlWindow(deps, result, shift(mid, 1), to, seenAt, touched);
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
    record(result.errors, [
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
  record(result.errors, auto.errors);
  result.requests = deps.client.requests;
}

export async function syncPlayloltcgCatalog(
  deps: PlayloltcgSyncDeps,
): Promise<PlayloltcgSyncResult> {
  const result = emptyResult();
  const now = clock(deps);
  const from = shift(now, -SYNC_LOOKBACK_DAYS);
  const touched: number[] = [];
  try {
    await syncShops(deps, result);
    await crawlWindow(deps, result, from, shift(now, FUTURE_HORIZON_DAYS), now, touched);
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
    if (error instanceof PlayloltcgBlockedError) {
      markBlocked(deps, result, now, error);
    } else {
      throw error;
    }
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
  await crawlWindow(deps, listing, shift(now, -RECENT_LISTING_DAYS), now, now, touched);
  const unique = [...new Set(touched)];
  const auto = await autoAcceptPlayloltcgEvents(deps, unique);
  result.listed = listing.rows;
  result.pulledForward = await deps.repos.playloltcgEvents.pullForwardRechecks(unique, now);
  record(
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
  const deadline = performance.now() + budgetMs;
  const before = deps.client.requests;
  const spent = () => deps.client.requests - before;
  const now = clock(deps);
  const result: PlayloltcgRecheckResult = {
    due: 0,
    processed: 0,
    requests: 0,
    fetched: 0,
    players: 0,
    decks: 0,
    acceptedPlayers: 0,
    listed: null,
    pulledForward: 0,
    backedOff: false,
    blocked: false,
    blockedUntil: null,
    errors: [],
  };

  let failedInARow = 0;
  // A row a failed write left due must not be visited twice in one pass.
  const visited = new Set<number>();
  let stopped = false;
  try {
    if (options.listing === true) {
      await refreshRecentListing(deps, now, result);
    }
    while (!stopped && spent() < PLAYLOLTCG_RUN_REQUESTS && performance.now() < deadline) {
      const due = await deps.repos.playloltcgEvents.dueForRecheck(clock(deps), RECHECK_PAGE_SIZE);
      const fresh = due.filter((row) => !visited.has(row.activityShopId));
      if (fresh.length === 0) {
        break;
      }
      for (const row of fresh) {
        visited.add(row.activityShopId);
        result.due++;
        const deckBudget = Math.max(MIN_DECKS_PER_VISIT, PLAYLOLTCG_RUN_REQUESTS - spent());
        const failed = await visitContained(deps, row, clock(deps), result, deckBudget);
        failedInARow = failed ? failedInARow + 1 : 0;
        if (failedInARow >= MAX_FAILED_VISITS_IN_A_ROW) {
          result.backedOff = true;
          result.blockedUntil = new Date(clock(deps).getTime() + BACKOFF_MS).toISOString();
          record(result.errors, [
            `Stopped after ${failedInARow} visits in a row failed; pausing for 30 minutes.`,
          ]);
        }
        if (
          result.backedOff ||
          spent() >= PLAYLOLTCG_RUN_REQUESTS ||
          performance.now() >= deadline
        ) {
          stopped = true;
          break;
        }
      }
    }
  } catch (error) {
    if (error instanceof PlayloltcgBlockedError) {
      deps.log.warn({ err: error }, "playloltcg WAF block");
      result.blocked = true;
      result.blockedUntil = cooldownUntil(now);
      record(result.errors, [error.message]);
    } else {
      throw error;
    }
  }
  result.requests = spent();
  return result;
}

/**
 * Catches everything but a block, so one event's failure can't starve the rows behind it.
 * A blocked event moves past the cool-down; left due, every later run starts on it.
 */
async function visitContained(
  deps: PlayloltcgSyncDeps,
  row: PlayloltcgRecheckRow,
  now: Date,
  result: PlayloltcgRecheckResult,
  deckBudget: number,
): Promise<boolean> {
  try {
    return await visitPlayloltcgEvent(deps, row, now, result, deckBudget);
  } catch (error) {
    if (error instanceof PlayloltcgBlockedError) {
      await deps.repos.playloltcgEvents.setRecheck(row.activityShopId, {
        nextCheckAt: new Date(now.getTime() + BLOCKED_EVENT_DEFER_MS),
        checkStage: row.checkStage,
      });
      throw error;
    }
    deps.log.warn({ err: error, activityShopId: row.activityShopId }, "Recheck visit failed");
    result.errors.push(errorText(error, `Event ${row.activityShopId}`));
    await grace(deps, row.activityShopId, now, row.checkStage);
    return true;
  }
}

async function visitPlayloltcgEvent(
  deps: PlayloltcgSyncDeps,
  row: PlayloltcgRecheckRow,
  now: Date,
  result: PlayloltcgRecheckResult,
  deckBudget: number,
): Promise<boolean> {
  const detailErrors: string[] = [];
  const detail = await readPlayloltcgDetail(deps, row.activityShopId, detailErrors);
  record(result.errors, detailErrors);
  if (detail === null) {
    await grace(deps, row.activityShopId, now, row.checkStage);
    return true;
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
    return false;
  }

  const fetched = await playloltcgDeepFetch(deps, row, detail, deckBudget);
  result.fetched++;
  result.players += fetched.players;
  result.decks += fetched.decks;
  result.acceptedPlayers += fetched.acceptedPlayers;
  record(result.errors, fetched.errors);
  if (!fetched.complete) {
    await grace(deps, row.activityShopId, now, row.checkStage);
    return true;
  }
  await (fetched.decksRemaining > 0
    ? resumeSoon(deps, row.activityShopId, now, row.checkStage)
    : advance());
  result.processed++;
  return false;
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
  const to = shift(now, FUTURE_HORIZON_DAYS);
  const resumeFrom = options.resumeFrom;
  let from = resumeFrom === undefined ? ARCHIVE_START : new Date(resumeFrom.getTime() + DAY_MS);
  if (resumeFrom !== undefined) {
    result.resumedFrom = resumeFrom.toISOString();
    result.coveredThrough = day(resumeFrom);
  }
  const touched: number[] = [];
  try {
    await syncShops(deps, result);
    while (from.getTime() <= to.getTime()) {
      const chunkTo = shift(from, BACKFILL_CHUNK_DAYS - 1);
      const windowTo = chunkTo.getTime() > to.getTime() ? to : chunkTo;
      await crawlWindow(deps, result, from, windowTo, now, touched);
      result.coveredThrough = day(windowTo);
      from = shift(windowTo, 1);
      if (runId !== undefined) {
        result.requests = deps.client.requests;
        if (await runCancelRequested(deps.repos.jobRuns, runId)) {
          result.cancelRequested = true;
          result.complete = false;
          break;
        }
        await writeRunHeartbeat(deps.repos.jobRuns, runId, result, clock(deps));
      }
    }
  } catch (error) {
    if (error instanceof PlayloltcgBlockedError) {
      markBlocked(deps, result, now, error);
    } else {
      throw error;
    }
  }
  await finish(deps, result, touched);
  return result;
}
