import { MINUTE_MS } from "@openrift/shared/format-date";
import { errorMessage } from "@openrift/shared/strings";

import { recordCapped } from "../../../../lib/json-coerce.js";
import { UVSGAMES_PROVIDER } from "../../../../lib/meta-providers.js";
import {
  firstRevisit,
  lifecycleStatus,
  nextRecheck,
  resumeSoon,
} from "../../lib/meta-recheck-schedule.js";
import { projectCatalogRow } from "../../lib/uvsgames-catalog.js";
import { completedRounds } from "../../lib/uvsgames-transform.js";
import type { UvsgamesListRow, UvsgamesRecheckRow } from "../../repositories/uvsgames-events.js";
import { refreshRecentListing } from "./catalog-sync.js";
import type { MetaDeepFetchResult } from "./deep-fetch.js";
import { deepFetchEvent } from "./deep-fetch.js";
import type { MetaSyncDeps } from "./deps.js";
import { clock } from "./deps.js";
import type { RecheckPassResult, VisitOutcome } from "./recheck-pass.js";
import {
  deferBlockedVisit,
  emptyRecheckPassResult,
  graceFailingVisit,
  runRecheckPass,
} from "./recheck-pass.js";
import { createRunHeartbeat } from "./run-heartbeat.js";
import { isPermanentRefusal, RunDeadlineError, sourceStopOf } from "./source-http.js";
import { isRecheckPassNoop } from "./sync-noop.js";

const RECHECK_BUDGET_MS = 5 * MINUTE_MS;

export interface RecheckOptions {
  runId?: string;
  /** Wall-clock milliseconds; the pass stops between two events once it is spent. */
  budgetMs?: number;
  listing?: boolean;
}

export interface MetaRecheckResult extends RecheckPassResult {
  fetched: number;
  players: number;
  acceptedPlayers: number;
  listed: number | null;
  pulledForward: number;
}

export function isRecheckNoop(result: MetaRecheckResult): boolean {
  return isRecheckPassNoop(result);
}

export async function processRechecks(
  deps: MetaSyncDeps,
  options: RecheckOptions = {},
): Promise<MetaRecheckResult> {
  const { runId, budgetMs = RECHECK_BUDGET_MS } = options;
  const result: MetaRecheckResult = {
    ...emptyRecheckPassResult(),
    fetched: 0,
    players: 0,
    acceptedPlayers: 0,
    listed: null,
    pulledForward: 0,
  };

  if (options.listing === true) {
    const listing = await refreshRecentListing(deps);
    result.listed = listing.rows;
    result.pulledForward = listing.pulledForward;
    recordCapped(
      result.errors,
      listing.errors.map((message) => `Listing: ${message}`),
    );
  }

  const watched = await deps.repos.uvsgamesEvents.watchedTemplates();
  return await runRecheckPass({
    result,
    heartbeat: createRunHeartbeat(deps, runId),
    log: deps.log,
    now: () => clock(deps),
    budgetMs,
    requests: () => deps.client.requests,
    due: (now, limit) => deps.repos.uvsgamesEvents.dueForRecheck(now, limit),
    keyOf: (row) => row.externalId,
    visit: (row, now) => visit(deps, row, watched, result, now, runId),
    grace: (row, now) => grace(deps, row, now, result),
    drop: (row) =>
      deps.repos.uvsgamesEvents.setRecheck(row.externalId, {
        nextCheckAt: null,
        checkStage: row.checkStage,
      }),
    stopOf: sourceStopOf,
    deferOnStop: deferBlockedVisit((row, schedule) =>
      deps.repos.uvsgamesEvents.setRecheck(row.externalId, schedule),
    ),
  });
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
    row.resultsFetchedAt === null ||
    row.resultsFetchedAt.getTime() < startedAt.getTime()
  ) {
    return;
  }
  await deps.repos.uvsgamesEvents.clearFailing(externalId);
  if (row.nextCheckAt === null || row.checkStage !== 0 || row.displayStatus !== "complete") {
    return;
  }
  await deps.repos.uvsgamesEvents.setRecheck(externalId, firstRevisit(clock(deps)));
}

async function visit(
  deps: MetaSyncDeps,
  row: UvsgamesRecheckRow,
  watched: ReadonlyMap<string, string | null>,
  result: MetaRecheckResult,
  now: Date,
  runId?: string,
): Promise<VisitOutcome> {
  const refreshed = await refreshStatus(deps, row, now, result.errors);
  if (refreshed === null) {
    await grace(deps, row, now, result);
    return "failed";
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

  let cut: "none" | "progressed" | "stalled" = "none";
  if (decision.deepFetch) {
    const fetched = await deepFetchEvent(deps, refreshed.row, runId, refreshed.detail, {
      stopOnSourceStop: true,
    });
    result.fetched++;
    result.players += fetched.players;
    result.acceptedPlayers += fetched.acceptedPlayers;
    recordCapped(result.errors, fetched.errors);
    if (fetched.cutShort === true) {
      cut = fetched.progressed === true ? "progressed" : "stalled";
    }
  }

  await deps.repos.uvsgamesEvents.setRecheck(
    row.externalId,
    cut === "progressed"
      ? { ...resumeSoon(now, 0), failingSince: null }
      : {
          nextCheckAt: decision.nextCheckAt,
          checkStage: cut === "stalled" ? row.checkStage : decision.checkStage,
          failingSince: null,
        },
  );
  // Counted here, not at entry, so a row that throws mid-visit lands in errors.
  result.processed++;
  return "ok";
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
    recordCapped(errors, [`Event ${row.externalId}: detail carried no readable projection`]);
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
    if (
      sourceStopOf(error) !== null ||
      isPermanentRefusal(error) ||
      error instanceof RunDeadlineError
    ) {
      throw error;
    }
    recordCapped(errors, [`Event ${externalId} detail: ${errorMessage(error)}`]);
    return null;
  }
}

function grace(
  deps: MetaSyncDeps,
  row: UvsgamesRecheckRow,
  now: Date,
  result: MetaRecheckResult,
): Promise<void> {
  return graceFailingVisit(row, row.externalId, now, result, (schedule) =>
    deps.repos.uvsgamesEvents.setRecheck(row.externalId, schedule),
  );
}
