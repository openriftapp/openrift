import { UVSGAMES_PROVIDER } from "../../../../lib/meta-providers.js";
import { firstRevisit, lifecycleStatus, nextRecheck } from "../../lib/meta-recheck-schedule.js";
import { projectCatalogRow } from "../../lib/uvsgames-catalog.js";
import { completedRounds } from "../../lib/uvsgames-transform.js";
import type { UvsgamesListRow, UvsgamesRecheckRow } from "../../repositories/uvsgames-events.js";
import { refreshRecentListing } from "./catalog-sync.js";
import { runCancelRequested, writeRunHeartbeat } from "./crawl-checkpoint.js";
import type { MetaDeepFetchResult } from "./deep-fetch.js";
import { deepFetchEvent } from "./deep-fetch.js";
import type { MetaSyncDeps } from "./deps.js";
import { clock, errorText } from "./deps.js";

export const RECHECK_BUDGET_MS = 5 * 60 * 1000;

const RECHECK_PAGE_SIZE = 100;

export interface RecheckOptions {
  runId?: string;
  /** Wall-clock milliseconds; the pass stops between two events once it is spent. */
  budgetMs?: number;
  listing?: boolean;
}

export interface MetaRecheckResult {
  due: number;
  processed: number;
  requests: number;
  fetched: number;
  players: number;
  acceptedPlayers: number;
  listed: number | null;
  pulledForward: number;
  cancelRequested: boolean;
  errors: string[];
}

export function isRecheckNoop(result: MetaRecheckResult): boolean {
  return result.processed === 0 && result.pulledForward === 0 && result.errors.length === 0;
}

export async function processRechecks(
  deps: MetaSyncDeps,
  options: RecheckOptions = {},
): Promise<MetaRecheckResult> {
  const { runId, budgetMs = RECHECK_BUDGET_MS } = options;
  const before = deps.client.requests;
  const deadline = performance.now() + budgetMs;
  const result: MetaRecheckResult = {
    due: 0,
    processed: 0,
    requests: 0,
    fetched: 0,
    players: 0,
    acceptedPlayers: 0,
    listed: null,
    pulledForward: 0,
    cancelRequested: false,
    errors: [],
  };

  if (options.listing === true) {
    const listing = await refreshRecentListing(deps);
    result.listed = listing.rows;
    result.pulledForward = listing.pulledForward;
    result.errors.push(...listing.errors.map((message) => `Listing: ${message}`));
  }

  const watched = await deps.repos.uvsgamesEvents.watchedTemplates();
  // A row a failed write left due must not be visited twice in one pass.
  const visited = new Set<string>();
  let stopped = false;
  while (!stopped && performance.now() < deadline) {
    const due = await deps.repos.uvsgamesEvents.dueForRecheck(clock(deps), RECHECK_PAGE_SIZE);
    const fresh = due.filter((row) => !visited.has(row.externalId));
    if (fresh.length === 0) {
      break;
    }
    for (const row of fresh) {
      visited.add(row.externalId);
      result.due++;
      await visitContained(deps, row, watched, result, runId);
      result.requests = deps.client.requests - before;
      if (runId !== undefined) {
        await heartbeat(deps, runId, result);
        if (await cancelled(deps, runId)) {
          result.cancelRequested = true;
          result.errors.push("Cancelled from the admin panel");
          stopped = true;
          break;
        }
      }
      if (performance.now() >= deadline) {
        stopped = true;
        break;
      }
    }
  }

  result.requests = deps.client.requests - before;
  return result;
}

export async function fetchEventNow(
  deps: MetaSyncDeps,
  row: UvsgamesListRow,
  runId?: string,
): Promise<MetaDeepFetchResult> {
  const startedAt = clock(deps);
  const fetched = await deepFetchEvent(deps, row, runId);
  await settleAfterManualFetch(deps, row.externalId, startedAt);
  return fetched;
}

export async function settleAfterManualFetch(
  deps: MetaSyncDeps,
  externalId: string,
  startedAt: Date,
): Promise<void> {
  const row = await deps.repos.uvsgamesEvents.byKey(externalId);
  if (
    row === undefined ||
    row.nextCheckAt === null ||
    row.checkStage !== 0 ||
    row.displayStatus !== "complete" ||
    row.resultsFetchedAt === null ||
    row.resultsFetchedAt.getTime() < startedAt.getTime()
  ) {
    return;
  }
  await deps.repos.uvsgamesEvents.setRecheck(externalId, firstRevisit(clock(deps)));
}

// A throw here must not abort the pass, or the failing row stays due and
// blocks every row queued behind it.
async function visitContained(
  deps: MetaSyncDeps,
  row: UvsgamesRecheckRow,
  watched: ReadonlyMap<string, string | null>,
  result: MetaRecheckResult,
  runId?: string,
): Promise<void> {
  try {
    await visit(deps, row, watched, result, runId);
  } catch (error) {
    deps.log.warn({ err: error, externalId: row.externalId }, "Recheck visit failed");
    result.errors.push(errorText(error, `Event ${row.externalId}`));
    await reschedule(deps, row, clock(deps), row.checkStage);
  }
}

// A failed cancel check must not abort the pass; log and keep going.
async function cancelled(deps: MetaSyncDeps, runId: string): Promise<boolean> {
  try {
    return await runCancelRequested(deps.repos.jobRuns, runId);
  } catch (error) {
    deps.log.warn({ err: error, runId }, "Recheck cancel check failed");
    return false;
  }
}

async function heartbeat(
  deps: MetaSyncDeps,
  runId: string,
  result: MetaRecheckResult,
): Promise<void> {
  try {
    await writeRunHeartbeat(deps.repos.jobRuns, runId, result, clock(deps));
  } catch (error) {
    deps.log.warn({ err: error, runId }, "Recheck heartbeat write failed");
  }
}

async function visit(
  deps: MetaSyncDeps,
  row: UvsgamesRecheckRow,
  watched: ReadonlyMap<string, string | null>,
  result: MetaRecheckResult,
  runId?: string,
): Promise<void> {
  const now = clock(deps);
  const refreshed = await refreshStatus(deps, row, now, result.errors);
  if (refreshed === null) {
    // Failed read: retry in an hour, not the ten-minute cadence.
    await reschedule(deps, row, now, row.checkStage);
    return;
  }

  const decision = nextRecheck({
    now,
    checkStage: refreshed.checkStage,
    displayStatus: refreshed.displayStatus,
    startAt: refreshed.startAt,
    decklistStatus: refreshed.decklistStatus,
    fetched: refreshed.fetched,
    decksComplete: refreshed.decksComplete,
    playersPending: refreshed.playersPending,
    newRounds: refreshed.newRounds,
    watched:
      refreshed.row.eventConfigurationTemplate !== null &&
      watched.has(refreshed.row.eventConfigurationTemplate),
    important: row.important,
  });

  if (row.metaEventId !== null) {
    await deps.repos.meta.setEventLifecycle(row.metaEventId, {
      status: lifecycleStatus({
        now,
        displayStatus: refreshed.displayStatus,
        startAt: refreshed.startAt,
      }),
      sourceCheckedAt: now,
    });
  }

  if (decision.deepFetch) {
    const fetched = await deepFetchEvent(deps, refreshed.row, runId, refreshed.detail);
    result.fetched++;
    result.players += fetched.players;
    result.acceptedPlayers += fetched.acceptedPlayers;
    result.errors.push(...fetched.errors);
  }

  await deps.repos.uvsgamesEvents.setRecheck(row.externalId, {
    nextCheckAt: decision.nextCheckAt,
    checkStage: decision.checkStage,
  });
  // Counted here, not at entry, so a row that throws mid-visit lands in errors.
  result.processed++;
}

interface RefreshedRow {
  row: UvsgamesListRow;
  detail: unknown;
  checkStage: number;
  displayStatus: string;
  startAt: Date;
  decklistStatus: string | null;
  fetched: boolean;
  decksComplete: boolean;
  playersPending: boolean;
  newRounds: boolean;
}

async function refreshStatus(
  deps: MetaSyncDeps,
  row: UvsgamesListRow,
  now: Date,
  errors: string[],
): Promise<RefreshedRow | null> {
  const detail = await readDetail(deps, row.externalId, errors);
  if (detail === null) {
    return null;
  }
  const projection = projectCatalogRow(detail);
  if (projection === null) {
    errors.push(`Event ${row.externalId}: detail carried no readable projection`);
    return null;
  }
  await deps.repos.uvsgamesEvents.upsertBatch([projection], now);

  const [standings, coverage, heldRounds] = await Promise.all([
    deps.repos.uvsgamesResults.standings(row.externalId),
    deps.repos.uvsgamesResults.deckCoverage(row.externalId),
    deps.repos.uvsgamesResults.heldRoundIds(row.externalId),
  ]);
  const held = new Set(heldRounds);

  return {
    row: { ...row, ...projection },
    detail,
    checkStage: row.checkStage,
    displayStatus: projection.displayStatus,
    startAt: projection.startAt,
    decklistStatus: projection.decklistStatus,
    // A cancelled event has zero standings and must still count as fetched.
    fetched: row.resultsFetchedAt !== null,
    decksComplete: coverage.outstanding.length === 0,
    // True while a standing the mirror holds has no live row yet: promotion
    // is still in flight.
    playersPending:
      standings.length > 0 && (await liveLagsMirror(deps, row.externalId, standings.length)),
    newRounds: completedRounds(detail).some((round) => !held.has(round.roundId)),
  };
}

async function liveLagsMirror(
  deps: MetaSyncDeps,
  externalId: string,
  mirrored: number,
): Promise<boolean> {
  const source = await deps.repos.meta.sourceByKey(UVSGAMES_PROVIDER, externalId);
  if (source === undefined) {
    return false;
  }
  const live = await deps.repos.meta.rawStandingsForEvent(source.metaEventId);
  return live.length < mirrored;
}

async function readDetail(
  deps: MetaSyncDeps,
  externalId: string,
  errors: string[],
): Promise<unknown> {
  try {
    return await deps.client.get<unknown>(`/api/v2/events/${externalId}/`);
  } catch (error) {
    errors.push(errorText(error, `Event ${externalId} detail`));
    return null;
  }
}

async function reschedule(
  deps: MetaSyncDeps,
  row: UvsgamesListRow,
  now: Date,
  checkStage: number,
): Promise<void> {
  await deps.repos.uvsgamesEvents.setRecheck(row.externalId, {
    nextCheckAt: new Date(now.getTime() + 60 * 60 * 1000),
    checkStage,
  });
}
