import { recordCapped, record } from "../../../../lib/json-coerce.js";
import { firstRevisit, lifecycleStatus, nextRecheck } from "../../lib/meta-recheck-schedule.js";
import type { PlayriftboundCell } from "../../lib/playriftbound-catalog.js";
import {
  cellOf,
  cellsBetween,
  playriftboundDisplayStatus,
  projectSearchResult,
  SEARCH_RADIUS_METERS,
} from "../../lib/playriftbound-catalog.js";
import type {
  PlayriftboundListRow,
  PlayriftboundRecheckRow,
  PlayriftboundUpsertInput,
} from "../../repositories/playriftbound-events.js";
import { runCancelRequested, writeRunHeartbeat } from "./crawl-checkpoint.js";
import { errorText } from "./deps.js";
import { autoAcceptPlayriftboundEvents } from "./playriftbound-accept.js";
import { isRunStopping, PlayriftboundUnavailableError } from "./playriftbound-client.js";
import type { PlayriftboundDeepFetchResult } from "./playriftbound-deep-fetch.js";
import { playriftboundDeepFetch, readPlayriftboundUpdatedAt } from "./playriftbound-deep-fetch.js";
import type { PlayriftboundSyncDeps } from "./playriftbound-deps.js";
import { clock } from "./playriftbound-deps.js";
import type { MetaSyncResultBase } from "./result.js";
import { emptyMetaSyncResult } from "./result.js";
import { cooldownUntil } from "./source-cooldown.js";

const SEARCH_QUERY = "CompeteTournamentSearch";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const SYNC_LOOKBACK_DAYS = 7;
const SYNC_HORIZON_DAYS = 14;
const SWEEP_LOOKBACK_DAYS = 45;

const PAGE_SIZE = 100;
const MAX_PAGES_PER_CELL = 50;

const SYNC_REQUEST_BUDGET = 6000;

const SWEEP_SOUTH = -56;
const SWEEP_NORTH = 72;
const SWEEP_HEARTBEAT_CELLS = 50;

const MAX_FAILURES_IN_A_ROW = 5;
const BACKOFF_MS = 30 * 60 * 1000;

const RECHECK_BUDGET_MS = 5 * 60 * 1000;
const RECHECK_PAGE_SIZE = 50;
const DROP_FAILING_AFTER_MS = 14 * DAY_MS;

export interface PlayriftboundSyncResult extends MetaSyncResultBase {
  cells: number;
  cellsWithEvents: number;
  blocked: boolean;
  blockedUntil: string | null;
  pausedUntil: string | null;
}

function emptyResult(): PlayriftboundSyncResult {
  return {
    ...emptyMetaSyncResult(),
    cells: 0,
    cellsWithEvents: 0,
    blocked: false,
    blockedUntil: null,
    pausedUntil: null,
  };
}

function backoffUntil(now: Date): string {
  return new Date(now.getTime() + BACKOFF_MS).toISOString();
}

function recordStop(
  result: { blocked: boolean; blockedUntil: string | null; pausedUntil: string | null },
  error: unknown,
  now: Date,
): void {
  if (error instanceof PlayriftboundUnavailableError) {
    result.pausedUntil = backoffUntil(now);
    return;
  }
  result.blocked = true;
  result.blockedUntil = cooldownUntil(now);
}

export function isPlayriftboundSyncNoop(result: PlayriftboundSyncResult): boolean {
  return (
    result.inserted === 0 &&
    result.changed === 0 &&
    result.missing === 0 &&
    result.autoAccepted === 0 &&
    result.autoHeld === 0 &&
    result.complete &&
    !result.cancelRequested &&
    result.errors.length === 0
  );
}

export interface PlayriftboundRecheckResult {
  due: number;
  processed: number;
  dropped: number;
  requests: number;
  fetched: number;
  players: number;
  matches: number;
  acceptedPlayers: number;
  pulledForward: number;
  backedOff: boolean;
  blocked: boolean;
  blockedUntil: string | null;
  pausedUntil: string | null;
  errors: string[];
}

export interface PlayriftboundRecheckOptions {
  /** Wall-clock milliseconds. */
  budgetMs?: number;
  rearm?: boolean;
}

export function isPlayriftboundRecheckNoop(result: PlayriftboundRecheckResult): boolean {
  return (
    result.processed === 0 &&
    result.pulledForward === 0 &&
    !result.blocked &&
    result.errors.length === 0
  );
}

function shift(from: Date, days: number): Date {
  return new Date(from.getTime() + days * DAY_MS);
}

interface SearchPage {
  nodes: unknown[];
  endCursor: string | null;
}

async function searchPage(
  deps: PlayriftboundSyncDeps,
  cell: PlayriftboundCell,
  from: Date,
  after: string | null,
): Promise<SearchPage> {
  const data = await deps.client.query<unknown>(SEARCH_QUERY, {
    sport: "rb",
    first: PAGE_SIZE,
    filter: {
      rb: {
        coords: { latitude: cell.latitude, longitude: cell.longitude },
        // Without it the source searches a much smaller default radius.
        distanceMeters: SEARCH_RADIUS_METERS,
        startDate: from.toISOString(),
      },
    },
    sortBy: { rb: "DATE" },
    ...(after === null ? {} : { after }),
  });
  const connection = record(record(data)?.competeTournamentSearch);
  const edges = Array.isArray(connection?.edges) ? connection.edges : [];
  const pageInfo = record(connection?.pageInfo);
  const endCursor =
    pageInfo?.hasNextPage === true && typeof pageInfo.endCursor === "string"
      ? pageInfo.endCursor
      : null;
  return { nodes: edges.map((edge) => record(edge)?.node), endCursor };
}

interface CrawlState {
  seenAt: Date;
  touched: string[];
  seen: Set<string>;
  failuresInARow: number;
}

/**
 * There is no end date to search by, only a start, so pages are sorted by
 * date and the walk stops at the horizon.
 */
async function crawlCell(
  deps: PlayriftboundSyncDeps,
  result: PlayriftboundSyncResult,
  cell: PlayriftboundCell,
  from: Date,
  horizon: Date,
  state: CrawlState,
): Promise<boolean> {
  let after: string | null = null;
  let found = false;
  for (let page = 0; page < MAX_PAGES_PER_CELL; page++) {
    const body = await searchPage(deps, cell, from, after);
    result.rows += body.nodes.length;
    const events: PlayriftboundUpsertInput[] = [];
    const organizers = [];
    let pastHorizon = false;
    for (const node of body.nodes) {
      const projected = projectSearchResult(node);
      if (projected === null) {
        continue;
      }
      found = true;
      if (projected.event.startAt.getTime() > horizon.getTime()) {
        pastHorizon = true;
        continue;
      }
      if (projected.organizer !== null) {
        organizers.push(projected.organizer);
      }
      // Neighbouring circles overlap, so most events arrive more than once.
      if (state.seen.has(projected.event.tournamentId)) {
        continue;
      }
      state.seen.add(projected.event.tournamentId);
      events.push(projected.event);
    }
    await deps.repos.playriftboundEvents.upsertOrganizers(organizers);
    const written = await deps.repos.playriftboundEvents.upsertBatch(events, state.seenAt);
    result.inserted += written.inserted.length;
    result.changed += written.changed.length;
    result.unchanged += written.unchanged.length;
    state.touched.push(...written.inserted, ...written.changed);
    if (pastHorizon || body.endCursor === null) {
      return found;
    }
    after = body.endCursor;
  }
  result.complete = false;
  recordCapped(result.errors, [
    `The search around ${cell.latitude.toFixed(2)}, ${cell.longitude.toFixed(2)} ran past ${MAX_PAGES_PER_CELL} pages, so part of it was not read.`,
  ]);
  return found;
}

/** `failed` means try the cell again later; `stop` means no other cell will fare better this run. */
type CellOutcome = "done" | "failed" | "stop";

/**
 * A block or a refused query stops the run and sets the source-wide cool-down.
 * Repeated other failures pause only this job.
 */
async function crawlCellContained(
  deps: PlayriftboundSyncDeps,
  result: PlayriftboundSyncResult,
  cell: PlayriftboundCell,
  from: Date,
  horizon: Date,
  state: CrawlState,
): Promise<CellOutcome> {
  try {
    if (await crawlCell(deps, result, cell, from, horizon, state)) {
      result.cellsWithEvents++;
    }
    state.failuresInARow = 0;
    return "done";
  } catch (error) {
    recordCapped(result.errors, [errorText(error, `Area ${cell.key}`)]);
    const now = clock(deps);
    if (isRunStopping(error)) {
      deps.log.warn({ err: error }, "playriftbound refused the crawl");
      recordStop(result, error, now);
      return "stop";
    }
    state.failuresInARow++;
    if (state.failuresInARow >= MAX_FAILURES_IN_A_ROW) {
      result.pausedUntil = backoffUntil(now);
      recordCapped(result.errors, [`Stopped after ${state.failuresInARow} areas in a row failed.`]);
      return "stop";
    }
    return "failed";
  }
}

function cellsOfOrganizers(points: readonly { latitude: number; longitude: number }[]) {
  const cells = new Map<string, PlayriftboundCell>();
  for (const point of points) {
    const cell = cellOf(point.latitude, point.longitude);
    cells.set(cell.key, cell);
  }
  return [...cells.values()];
}

async function finish(
  deps: PlayriftboundSyncDeps,
  result: PlayriftboundSyncResult,
  touched: readonly string[],
): Promise<void> {
  const auto = await autoAcceptPlayriftboundEvents(deps, [...new Set(touched)]);
  result.autoAccepted = auto.accepted;
  result.autoHeld = auto.held;
  recordCapped(result.errors, auto.errors);
  result.requests = deps.client.requests;
}

/** Searches around every store already known; the discovery sweep finds new regions. */
export async function syncPlayriftboundCatalog(
  deps: PlayriftboundSyncDeps,
): Promise<PlayriftboundSyncResult> {
  const result = emptyResult();
  const now = clock(deps);
  const from = shift(now, -SYNC_LOOKBACK_DAYS);
  const horizon = shift(now, SYNC_HORIZON_DAYS);
  const state: CrawlState = { seenAt: now, touched: [], seen: new Set(), failuresInARow: 0 };
  const cells = cellsOfOrganizers(await deps.repos.playriftboundEvents.organizerCoordinates());
  if (cells.length === 0) {
    result.complete = false;
    result.errors.push("No stores are known yet. Run the discovery sweep first.");
    return result;
  }
  for (const cell of cells) {
    if (deps.client.requests >= SYNC_REQUEST_BUDGET) {
      result.complete = false;
      recordCapped(result.errors, [
        `Stopped at the ${SYNC_REQUEST_BUDGET}-request budget with ${cells.length - result.cells} areas left.`,
      ]);
      break;
    }
    const outcome = await crawlCellContained(deps, result, cell, from, horizon, state);
    result.cells++;
    if (outcome !== "done") {
      result.complete = false;
    }
    if (outcome === "stop") {
      break;
    }
  }
  // A gap in coverage looks identical to a row the source stopped listing, so
  // only a run that covered every area may mark a stored row missing.
  if (result.complete) {
    result.missing = await deps.repos.playriftboundEvents.markMissing({
      from,
      to: horizon,
      seenBefore: now,
      at: now,
    });
  }
  await finish(deps, result, state.touched);
  return result;
}

export interface PlayriftboundBackfillOptions {
  resumeFrom?: number;
}

/**
 * Searches every cell of the inhabited map, about 10,000 of them. It is the
 * only way a region with no known store is found.
 */
export async function backfillPlayriftbound(
  deps: PlayriftboundSyncDeps,
  runId?: string,
  options: PlayriftboundBackfillOptions = {},
): Promise<PlayriftboundSyncResult> {
  const result = emptyResult();
  const now = clock(deps);
  const from = shift(now, -SWEEP_LOOKBACK_DAYS);
  const horizon = shift(now, SYNC_HORIZON_DAYS);
  const state: CrawlState = { seenAt: now, touched: [], seen: new Set(), failuresInARow: 0 };
  const cells = cellsBetween(SWEEP_SOUTH, SWEEP_NORTH);
  const start = options.resumeFrom === undefined ? 0 : options.resumeFrom + 1;
  if (options.resumeFrom !== undefined) {
    result.resumedFrom = String(options.resumeFrom);
    result.coveredThrough = String(options.resumeFrom);
  }

  const failed: number[] = [];
  let stopped = false;
  for (let index = start; index < cells.length; index++) {
    const outcome = await crawlCellContained(
      deps,
      result,
      cells[index] as PlayriftboundCell,
      from,
      horizon,
      state,
    );
    if (outcome === "stop") {
      failed.push(index);
      stopped = true;
      break;
    }
    if (outcome === "failed") {
      failed.push(index);
    }
    result.cells++;
    // A checkpoint past a failed cell would resume beyond it.
    const firstFailed = failed[0];
    if (firstFailed === undefined) {
      result.coveredThrough = String(index);
    } else {
      result.coveredThrough = firstFailed === 0 ? null : String(firstFailed - 1);
    }
    if (runId !== undefined && (index - start) % SWEEP_HEARTBEAT_CELLS === 0) {
      result.requests = deps.client.requests;
      if (await runCancelRequested(deps.repos.jobRuns, runId)) {
        result.cancelRequested = true;
        stopped = true;
        break;
      }
      // A run that dies mid-sweep must leave a checkpoint the next run can resume from.
      await writeRunHeartbeat(
        deps.repos.jobRuns,
        runId,
        { ...result, complete: false },
        clock(deps),
      );
    }
  }

  const stillFailed: number[] = [];
  for (const index of failed) {
    const outcome = stopped
      ? "stop"
      : await crawlCellContained(
          deps,
          result,
          cells[index] as PlayriftboundCell,
          from,
          horizon,
          state,
        );
    if (outcome !== "done") {
      stillFailed.push(index);
    }
    if (outcome === "stop") {
      stopped = true;
    }
  }
  const firstStillFailed = stillFailed[0];
  if (firstStillFailed !== undefined) {
    result.coveredThrough = firstStillFailed === 0 ? null : String(firstStillFailed - 1);
  } else if (!stopped && start < cells.length) {
    // A finished pass leaves nothing to continue, even when a cell overflowed.
    result.coveredThrough = result.complete ? String(cells.length - 1) : null;
  }
  result.complete &&= !stopped && stillFailed.length === 0;
  await finish(deps, result, state.touched);
  return result;
}

async function grace(
  deps: PlayriftboundSyncDeps,
  row: PlayriftboundRecheckRow,
  now: Date,
  result: PlayriftboundRecheckResult,
): Promise<void> {
  const failingSince = row.failingSince ?? now;
  if (now.getTime() - failingSince.getTime() >= DROP_FAILING_AFTER_MS) {
    await deps.repos.playriftboundEvents.setRecheck(row.tournamentId, {
      nextCheckAt: null,
      checkStage: row.checkStage,
    });
    result.dropped++;
    recordCapped(result.errors, [
      `Event ${row.tournamentId} has failed for two weeks and is no longer rechecked.`,
    ]);
    return;
  }
  await deps.repos.playriftboundEvents.setRecheck(row.tournamentId, {
    nextCheckAt: new Date(now.getTime() + HOUR_MS),
    checkStage: row.checkStage,
    failingSince,
  });
}

/**
 * The poller answers with the event's last-changed instant, so the full detail
 * is fetched only when something moved since the mirror's copy.
 */
async function visitPlayriftboundEvent(
  deps: PlayriftboundSyncDeps,
  row: PlayriftboundRecheckRow,
  now: Date,
  result: PlayriftboundRecheckResult,
): Promise<boolean> {
  if (row.startAt.getTime() > now.getTime()) {
    await deps.repos.playriftboundEvents.setRecheck(row.tournamentId, {
      nextCheckAt: row.startAt,
      checkStage: 0,
      failingSince: null,
    });
    result.processed++;
    return false;
  }

  const updatedAt = await readPlayriftboundUpdatedAt(deps, row.tournamentId);
  const changed =
    row.resultsFetchedAt === null ||
    updatedAt === null ||
    row.sourceUpdatedAt === null ||
    updatedAt.getTime() !== row.sourceUpdatedAt.getTime();

  let facts = {
    structure: row.structure,
    roundCount: row.roundCount,
    roundsPlayed: row.roundsPlayed ?? 0,
    roundsFinalized: row.roundsFinalized ?? 0,
    sourceUpdatedAt: row.sourceUpdatedAt,
  };
  let fetched = row.resultsFetchedAt !== null;
  let gone = false;
  const fetchOnce = async (): Promise<boolean> => {
    const deep = await playriftboundDeepFetch(deps, row.tournamentId, row.startAt);
    tally(result, deep);
    gone = deep.gone;
    if (!deep.complete || deep.facts === null) {
      return false;
    }
    facts = deep.facts;
    fetched = true;
    return true;
  };

  const displayFor = () => playriftboundDisplayStatus(facts, row.startAt, now);
  const decide = () =>
    nextRecheck({
      now,
      checkStage: row.checkStage,
      displayStatus: displayFor(),
      startAt: row.startAt,
      decklistStatus: null,
      fetched,
      decksComplete: true,
      playersPending: false,
      newRounds: false,
      watched: false,
      important: row.important,
    });

  let ok = !changed || (await fetchOnce());
  // Stage 0 on a finished event wants the final sheet; a fetch this visit already is one.
  if (ok && !changed && decide().deepFetch) {
    ok = await fetchOnce();
  }
  // An event the poller still answers for is not gone, whatever the detail read says.
  if (gone && updatedAt === null) {
    await deps.repos.playriftboundEvents.setRecheck(row.tournamentId, {
      nextCheckAt: null,
      checkStage: row.checkStage,
    });
    result.dropped++;
    result.processed++;
    return false;
  }
  if (!ok) {
    await grace(deps, row, now, result);
    return true;
  }

  const displayStatus = displayFor();
  const decision = decide();
  if (row.metaEventId !== null) {
    await deps.repos.meta.setEventLifecycle(row.metaEventId, {
      status: lifecycleStatus({ now, displayStatus, startAt: row.startAt }),
      sourceCheckedAt: now,
    });
  }
  await deps.repos.playriftboundEvents.setRecheck(row.tournamentId, {
    nextCheckAt: decision.nextCheckAt,
    checkStage: decision.checkStage,
    failingSince: null,
  });
  result.processed++;
  return false;
}

function tally(result: PlayriftboundRecheckResult, deep: PlayriftboundDeepFetchResult): void {
  result.fetched++;
  result.players += deep.players;
  result.matches += deep.matches;
  result.acceptedPlayers += deep.acceptedPlayers;
  recordCapped(result.errors, deep.errors);
}

/**
 * Catches everything but a run-stopping error, so one event's failure can't
 * starve the rows behind it. A block or refused query defers it to the cool-down's end.
 */
async function visitContained(
  deps: PlayriftboundSyncDeps,
  row: PlayriftboundRecheckRow,
  now: Date,
  result: PlayriftboundRecheckResult,
): Promise<boolean> {
  try {
    return await visitPlayriftboundEvent(deps, row, now, result);
  } catch (error) {
    if (isRunStopping(error)) {
      if (!(error instanceof PlayriftboundUnavailableError)) {
        await deps.repos.playriftboundEvents.setRecheck(row.tournamentId, {
          nextCheckAt: new Date(cooldownUntil(now)),
          checkStage: row.checkStage,
        });
      }
      throw error;
    }
    deps.log.warn({ err: error, tournamentId: row.tournamentId }, "Recheck visit failed");
    recordCapped(result.errors, [errorText(error, `Event ${row.tournamentId}`)]);
    await grace(deps, row, now, result);
    return true;
  }
}

export async function processPlayriftboundRechecks(
  deps: PlayriftboundSyncDeps,
  options: PlayriftboundRecheckOptions = {},
): Promise<PlayriftboundRecheckResult> {
  const { budgetMs = RECHECK_BUDGET_MS } = options;
  const deadline = performance.now() + budgetMs;
  const before = deps.client.requests;
  const now = clock(deps);
  const result: PlayriftboundRecheckResult = {
    due: 0,
    processed: 0,
    dropped: 0,
    requests: 0,
    fetched: 0,
    players: 0,
    matches: 0,
    acceptedPlayers: 0,
    pulledForward: 0,
    backedOff: false,
    blocked: false,
    blockedUntil: null,
    pausedUntil: null,
    errors: [],
  };

  if (options.rearm === true) {
    result.pulledForward = await deps.repos.playriftboundEvents.rearmRunningEvents(now);
  }

  let failedInARow = 0;
  // A row a failed write left due must not be visited twice in one pass.
  const visited = new Set<string>();
  let stopped = false;
  try {
    while (!stopped && performance.now() < deadline) {
      const due = await deps.repos.playriftboundEvents.dueForRecheck(
        clock(deps),
        RECHECK_PAGE_SIZE,
      );
      const fresh = due.filter((row) => !visited.has(row.tournamentId));
      if (fresh.length === 0) {
        break;
      }
      for (const row of fresh) {
        visited.add(row.tournamentId);
        result.due++;
        const failed = await visitContained(deps, row, clock(deps), result);
        failedInARow = failed ? failedInARow + 1 : 0;
        if (failedInARow >= MAX_FAILURES_IN_A_ROW) {
          result.backedOff = true;
          result.pausedUntil = backoffUntil(clock(deps));
          recordCapped(result.errors, [
            `Stopped after ${failedInARow} visits in a row failed; pausing for 30 minutes.`,
          ]);
        }
        if (result.backedOff || performance.now() >= deadline) {
          stopped = true;
          break;
        }
      }
    }
  } catch (error) {
    if (!isRunStopping(error) || !(error instanceof Error)) {
      throw error;
    }
    deps.log.warn({ err: error }, "playriftbound refused the recheck");
    recordStop(result, error, now);
    recordCapped(result.errors, [error.message]);
  }
  result.requests = deps.client.requests - before;
  return result;
}

export async function fetchPlayriftboundEvent(
  deps: PlayriftboundSyncDeps,
  row: PlayriftboundListRow,
): Promise<PlayriftboundDeepFetchResult & { blockedUntil: string | null }> {
  const now = clock(deps);
  let result: PlayriftboundDeepFetchResult;
  try {
    result = await playriftboundDeepFetch(deps, row.tournamentId, row.startAt);
  } catch (error) {
    if (!isRunStopping(error) || !(error instanceof Error)) {
      throw error;
    }
    return {
      tournamentId: row.tournamentId,
      requests: deps.client.requests,
      players: 0,
      matches: 0,
      acceptedPlayers: 0,
      skippedPlayers: 0,
      facts: null,
      complete: false,
      gone: false,
      errors: [error.message],
      blockedUntil: error instanceof PlayriftboundUnavailableError ? null : cooldownUntil(now),
    };
  }
  if (
    result.complete &&
    result.facts !== null &&
    playriftboundDisplayStatus(result.facts, row.startAt, now) === "complete" &&
    row.nextCheckAt !== null &&
    row.checkStage === 0
  ) {
    await deps.repos.playriftboundEvents.setRecheck(row.tournamentId, firstRevisit(now));
  }
  if (result.complete) {
    await deps.repos.playriftboundEvents.clearFailing(row.tournamentId);
  }
  return { ...result, blockedUntil: null };
}
