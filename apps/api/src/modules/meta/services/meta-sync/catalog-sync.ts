import { errorMessage } from "@openrift/shared/strings";

import { shiftDays } from "../../lib/meta-durations.js";
import type {
  UvsgamesCatalogProjection,
  UvsgamesProbedProjection,
} from "../../lib/uvsgames-catalog.js";
import { projectCatalogRow } from "../../lib/uvsgames-catalog.js";
import { autoAcceptCatalogEvents, withdrawCancelledCatalogEvents } from "./accept.js";
import type { CrawlRun } from "./crawl-run.js";
import { createCrawlRun } from "./crawl-run.js";
import type { MetaSyncDeps } from "./deps.js";
import { clock, EVENTS_PATH, GAME_SLUG } from "./deps.js";
import { probeMirroredId } from "./id-sweep.js";
import type { MetaSyncResultBase } from "./result.js";
import { emptyMetaSyncResult } from "./result.js";
import { createRunHeartbeat } from "./run-heartbeat.js";
import { sourceStopOf } from "./source-http.js";
import type { SourceStopFields } from "./source-stop.js";
import { applySourceStop } from "./source-stop.js";
import { isSyncNoop } from "./sync-noop.js";
import { syncEventTemplates } from "./templates.js";
import type { UvsQuery } from "./uvsgames-client.js";
import { MAX_PAGE_SIZE } from "./uvsgames-client.js";

// Walked by date range, not page number: the listing has no stable sort and
// ties heavily on start_datetime, so offset paging drops and duplicates rows.

const SYNC_LOOKBACK_DAYS = 7;

const RECENT_LISTING_DAYS = 3;

const MAX_REQUESTS_PER_LISTING = 200;

export const ARCHIVE_START = new Date("2025-01-01T00:00:00Z");

const FUTURE_HORIZON_DAYS = 730;

const MAX_SPLIT = 12;

const MAX_REQUESTS_PER_CRAWL = 6000;

const MAX_INSTANT_ROWS = 300;

const INSTANT_PROBE_PAGES = 5;

const MAX_CONSECUTIVE_FAILURES = 20;

const HEARTBEAT_RANGES = 25;

const MAX_MISSING_PROBES = 1000;

const HEARTBEAT_PROBES = 100;

const MAX_SKIPPED = 50;

export interface MetaCatalogSyncResult extends MetaSyncResultBase, SourceStopFields {
  ranges: number;
  unreadable: number;
  skipped: number;
  templatesNamed: number;
  templatesRetired: number;
  missingFound: number;
  missingAbsent: number;
  withdrawn: number;
  skippedRanges: string[];
}

function emptyResult(): MetaCatalogSyncResult {
  return {
    ...emptyMetaSyncResult(),
    ranges: 0,
    unreadable: 0,
    skipped: 0,
    templatesNamed: 0,
    templatesRetired: 0,
    missingFound: 0,
    missingAbsent: 0,
    withdrawn: 0,
    skippedRanges: [],
    blocked: false,
    blockedUntil: null,
    pausedUntil: null,
  };
}

export function isCatalogSyncNoop(result: MetaCatalogSyncResult): boolean {
  return isSyncNoop(result, [result.missingFound, result.missingAbsent, result.withdrawn]);
}

interface CrawlContext {
  result: MetaCatalogSyncResult;
  touched: string[];
  seenAt: Date;
  filter: UvsQuery;
  run: CrawlRun<MetaCatalogSyncResult>;
  checkpoints: boolean;
  consecutiveFailures: number;
}

function newContext(
  deps: MetaSyncDeps,
  options: { filter?: UvsQuery; maxRequests: number; runId?: string; checkpoints?: boolean },
): CrawlContext {
  const result = emptyResult();
  return {
    result,
    touched: [],
    seenAt: clock(deps),
    filter: options.filter ?? {},
    run: createCrawlRun({
      result,
      heartbeat: createRunHeartbeat(deps, options.runId),
      requests: () => deps.client.requests,
      maxRequests: options.maxRequests,
      beatEvery: HEARTBEAT_RANGES,
    }),
    checkpoints: options.checkpoints ?? false,
    consecutiveFailures: 0,
  };
}

function record(ctx: CrawlContext, message: string): void {
  ctx.run.record(message);
}

// The counters alone cannot say a crawl fell short, so a gap is marked explicitly.
function skip(ctx: CrawlContext, detail: string): void {
  ctx.result.complete = false;
  if (ctx.result.skippedRanges.length < MAX_SKIPPED) {
    ctx.result.skippedRanges.push(detail);
  }
}

// Ranges are visited in chronological order, so a finished range's end
// instant alone is the whole resume state.
function cover(ctx: CrawlContext, to: Date): void {
  if (ctx.checkpoints) {
    ctx.result.coveredThrough = to.toISOString();
  }
}

async function keepGoing(ctx: CrawlContext): Promise<boolean> {
  if (!ctx.run.stopped && ctx.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    ctx.run.stop(`Stopped after ${ctx.consecutiveFailures} listing queries failed in a row`);
  }
  return await ctx.run.tick();
}

function rangeLabel(from: Date, to: Date): string {
  return from.getTime() === to.getTime()
    ? from.toISOString()
    : `${from.toISOString()}..${to.toISOString()}`;
}

async function readRange(
  deps: MetaSyncDeps,
  ctx: CrawlContext,
  from: Date,
  to: Date,
  page: number,
  pageSize: number,
): Promise<{ results: unknown[]; count: number } | null> {
  try {
    const body = await deps.client.page<unknown>(
      EVENTS_PATH,
      {
        game_slug: GAME_SLUG,
        ...ctx.filter,
        start_date_after: from.toISOString(),
        start_date_before: to.toISOString(),
      },
      page,
      pageSize,
    );
    ctx.result.ranges++;
    ctx.consecutiveFailures = 0;
    return { results: body.results, count: body.count };
  } catch (error) {
    const stop = sourceStopOf(error);
    if (stop !== null) {
      ctx.run.stop(applySourceStop(ctx.result, stop, clock(deps), error));
      return null;
    }
    ctx.consecutiveFailures++;
    record(ctx, `${rangeLabel(from, to)} page ${page}: ${errorMessage(error)}`);
    return null;
  }
}

async function absorb(deps: MetaSyncDeps, ctx: CrawlContext, rows: unknown[]): Promise<void> {
  ctx.result.rows += rows.length;
  const projections: UvsgamesCatalogProjection[] = [];
  for (const raw of rows) {
    const projection = projectCatalogRow(raw);
    if (projection === null) {
      ctx.result.unreadable++;
      continue;
    }
    projections.push(projection);
  }

  const written = await deps.repos.uvsgamesEvents.upsertBatch(projections, ctx.seenAt);
  ctx.result.inserted += written.inserted.length;
  ctx.result.changed += written.changed.length;
  ctx.result.unchanged += written.unchanged.length;
  ctx.touched.push(...written.inserted, ...written.changed);
}

// Never fewer than two: a split that handed back the same range would recurse forever.
function splitParts(count: number): number {
  return Math.min(MAX_SPLIT, Math.max(2, Math.ceil(count / MAX_PAGE_SIZE)));
}

// Contiguous inclusive sub-ranges covering [from, to] exactly once. A range
// narrower than `parts` milliseconds yields one slice per millisecond instead.
export function sliceRange(from: Date, to: Date, parts: number): { from: Date; to: Date }[] {
  const start = from.getTime();
  const points = to.getTime() - start + 1;
  const slices = Math.min(parts, points);
  const out: { from: Date; to: Date }[] = [];
  let cursor = start;
  for (let index = 1; index <= slices; index++) {
    const end = start + Math.floor((index * points) / slices) - 1;
    out.push({ from: new Date(cursor), to: new Date(end) });
    cursor = end + 1;
  }
  return out;
}

async function crawlSlices(
  deps: MetaSyncDeps,
  ctx: CrawlContext,
  from: Date,
  to: Date,
  parts: number,
): Promise<void> {
  for (const slice of sliceRange(from, to, parts)) {
    await crawlRange(deps, ctx, slice.from, slice.to);
  }
}

async function crawlRange(
  deps: MetaSyncDeps,
  ctx: CrawlContext,
  from: Date,
  to: Date,
): Promise<void> {
  if (!(await keepGoing(ctx))) {
    return;
  }

  const body = await readRange(deps, ctx, from, to, 1, MAX_PAGE_SIZE);
  if (body === null) {
    if (from.getTime() < to.getTime()) {
      await crawlSlices(deps, ctx, from, to, 2);
      return;
    }
    await salvageInstant(deps, ctx, from);
    if (!ctx.run.stopped) {
      cover(ctx, to);
    }
    return;
  }

  // The slices re-read this whole range, page one included, so absorbing it
  // here first would count every row on it twice in the run's summary.
  if (body.count > body.results.length && from.getTime() < to.getTime()) {
    await crawlSlices(deps, ctx, from, to, splitParts(body.count));
    return;
  }

  await absorb(deps, ctx, body.results);
  if (body.count > body.results.length) {
    await drainInstant(deps, ctx, from, body.count);
  }
  if (!ctx.run.stopped) {
    cover(ctx, to);
  }
}

// Time cannot split a single instant any further, so this is the one place
// left that pages by offset, and where an unstable tie order can drop a row.
async function drainInstant(
  deps: MetaSyncDeps,
  ctx: CrawlContext,
  at: Date,
  count: number,
): Promise<void> {
  const pages = Math.ceil(count / MAX_PAGE_SIZE);
  for (let page = 2; page <= pages; page++) {
    if (!(await keepGoing(ctx))) {
      return;
    }
    const body = await readRange(deps, ctx, at, at, page, MAX_PAGE_SIZE);
    if (body === null) {
      skip(ctx, `${at.toISOString()} page ${page}`);
      continue;
    }
    await absorb(deps, ctx, body.results);
  }
}

// Walks a refused instant a row at a time so only the row that breaks the
// serializer is lost; keeps probing since the row count needs a page to answer.
async function salvageInstant(deps: MetaSyncDeps, ctx: CrawlContext, at: Date): Promise<void> {
  let total: number | null = null;
  let page = 1;

  while (page <= Math.min(total ?? INSTANT_PROBE_PAGES, MAX_INSTANT_ROWS)) {
    if (!(await keepGoing(ctx))) {
      return;
    }
    const body = await readRange(deps, ctx, at, at, page, 1);
    if (body === null) {
      ctx.result.skipped++;
      skip(ctx, `${at.toISOString()} row ${page}`);
      page++;
      continue;
    }
    total = body.count;
    await absorb(deps, ctx, body.results);
    page++;
  }

  if (total === null) {
    skip(ctx, `${at.toISOString()} (unreadable at every probed row)`);
  }
}

// Runs after the crawl so a template id the crawl just met gets its row in
// the same run; skipped when the crawl stopped short to save one more request.
async function finish(deps: MetaSyncDeps, ctx: CrawlContext): Promise<MetaCatalogSyncResult> {
  const auto = await autoAcceptCatalogEvents(deps, [...new Set(ctx.touched)]);
  ctx.result.autoAccepted = auto.accepted;
  ctx.result.autoHeld = auto.held;
  for (const message of auto.errors) {
    record(ctx, message);
  }
  ctx.result.withdrawn = await withdrawCancelledCatalogEvents(deps);
  if (!ctx.run.stopped) {
    const templates = await syncEventTemplates(deps);
    ctx.result.templatesNamed = templates.named;
    ctx.result.templatesRetired = templates.retired;
    for (const message of templates.errors) {
      record(ctx, message);
    }
  }
  return ctx.run.finish();
}

// The listing drops cancelled, archived and unlisted events, while the
// per-event endpoint still serves them.
async function probeMissing(deps: MetaSyncDeps, ctx: CrawlContext): Promise<void> {
  if (ctx.run.stopped) {
    return;
  }
  const ids = await deps.repos.uvsgamesEvents.unprobedMissing(MAX_MISSING_PROBES);
  const found: UvsgamesProbedProjection[] = [];
  const absent: string[] = [];
  let failures = 0;
  for (const [index, id] of ids.entries()) {
    if (index > 0 && index % HEARTBEAT_PROBES === 0) {
      await ctx.run.checkpoint();
    }
    if (ctx.run.stopped) {
      break;
    }
    let outcome;
    try {
      outcome = await probeMirroredId(deps, Number(id));
    } catch (error) {
      const stop = sourceStopOf(error);
      if (stop === null) {
        throw error;
      }
      ctx.run.stop(applySourceStop(ctx.result, stop, clock(deps), error));
      break;
    }
    if (outcome.kind === "event") {
      found.push(outcome.projection);
      failures = 0;
    } else if (outcome.kind === "probe" && outcome.probe.outcome === "absent") {
      absent.push(id);
      failures = 0;
    } else if (outcome.kind === "probe") {
      // The source answered, so this is no sign of a block worth stopping for.
      record(ctx, `Event ${id}: ${outcome.probe.outcome}`);
      failures = 0;
    } else {
      record(ctx, outcome.error);
      failures++;
      if (failures >= MAX_CONSECUTIVE_FAILURES) {
        record(ctx, `Stopped probing missing events after ${failures} failures in a row`);
        break;
      }
    }
  }
  await deps.repos.uvsgamesEvents.refreshFromProbe(found);
  await deps.repos.uvsgamesEvents.markProbeAbsent(absent);
  ctx.result.missingFound = found.length;
  ctx.result.missingAbsent = absent.length;
}

// Rows are flagged missing only when the crawl fully covered the range; a
// partial run must not mistake unreached rows for dropped ones.
export async function syncCatalog(
  deps: MetaSyncDeps,
  runId?: string,
): Promise<MetaCatalogSyncResult> {
  const now = clock(deps);
  const from = shiftDays(now, -SYNC_LOOKBACK_DAYS);
  const ctx = newContext(deps, { maxRequests: MAX_REQUESTS_PER_CRAWL, runId, checkpoints: true });

  await crawlRange(deps, ctx, from, shiftDays(now, FUTURE_HORIZON_DAYS));

  if (ctx.result.complete) {
    ctx.result.missing = await deps.repos.uvsgamesEvents.markMissing({
      from,
      to: now,
      seenBefore: now,
      at: now,
    });
  }
  await probeMissing(deps, ctx);

  return await finish(deps, ctx);
}

export interface RecentListingResult {
  rows: number;
  autoAccepted: number;
  autoHeld: number;
  pulledForward: number;
  errors: string[];
}

/** Re-arms the recheck of every event from the last few days whose listing row changed. */
export async function refreshRecentListing(deps: MetaSyncDeps): Promise<RecentListingResult> {
  const now = clock(deps);
  const ctx = newContext(deps, { maxRequests: MAX_REQUESTS_PER_LISTING });
  await crawlRange(deps, ctx, shiftDays(now, -RECENT_LISTING_DAYS), now);
  const touched = [...new Set(ctx.touched)];
  const auto = await autoAcceptCatalogEvents(deps, touched);
  for (const message of auto.errors) {
    record(ctx, message);
  }
  const pulledForward = await deps.repos.uvsgamesEvents.pullForwardRechecks(touched, now);
  return {
    rows: ctx.result.rows,
    autoAccepted: auto.accepted,
    autoHeld: auto.held,
    pulledForward,
    errors: ctx.result.errors,
  };
}

export interface BackfillOptions {
  resumeFrom?: Date;
}

// Manual full resync only; nothing scheduled calls this. Old completed
// events are crawled once, by this, and never again.
export async function backfillCatalog(
  deps: MetaSyncDeps,
  runId?: string,
  options: BackfillOptions = {},
): Promise<MetaCatalogSyncResult> {
  const now = clock(deps);
  const to = shiftDays(now, FUTURE_HORIZON_DAYS);
  const ctx = newContext(deps, { maxRequests: MAX_REQUESTS_PER_CRAWL, runId, checkpoints: true });

  const resumeFrom = options.resumeFrom;
  const from = resumeFrom === undefined ? ARCHIVE_START : new Date(resumeFrom.getTime() + 1);
  if (resumeFrom !== undefined) {
    ctx.result.resumedFrom = resumeFrom.toISOString();
    ctx.result.coveredThrough = resumeFrom.toISOString();
  }

  if (from.getTime() <= to.getTime()) {
    await crawlRange(deps, ctx, from, to);
  }

  return await finish(deps, ctx);
}
