import { record, instant } from "../../../../lib/json-coerce.js";
import { PLAYRIFTBOUND_PROVIDER } from "../../../../lib/meta-providers.js";
import type { PlayriftboundDetailFacts } from "../../lib/playriftbound-catalog.js";
import {
  phasesToStore,
  playriftboundDisplayStatus,
  projectTournamentDetail,
} from "../../lib/playriftbound-catalog.js";
import { promoteMetaEvent } from "../meta-promote.js";
import { isRunStopping, PlayriftboundRefusedError } from "./playriftbound-client.js";
import type { PlayriftboundSyncDeps } from "./playriftbound-deps.js";
import { clock } from "./playriftbound-deps.js";

const DETAIL_QUERY = "GetCompeteTournamentForRiftboundPlayer";
const POLLER_QUERY = "GetCompeteRbRefreshPoller";

export interface PlayriftboundDeepFetchResult {
  tournamentId: string;
  requests: number;
  players: number;
  matches: number;
  acceptedPlayers: number;
  skippedPlayers: number;
  facts: PlayriftboundDetailFacts | null;
  complete: boolean;
  gone: boolean;
  errors: string[];
}

function failure(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * The source's last-changed instant; the poller answers with aliased `t.u`. A
 * refusal for this one event, which it may have deleted, returns null.
 */
export async function readPlayriftboundUpdatedAt(
  deps: PlayriftboundSyncDeps,
  tournamentId: string,
): Promise<Date | null> {
  try {
    const data = await deps.client.query<unknown>(POLLER_QUERY, { tournamentId });
    return instant(record(record(data)?.t)?.u);
  } catch (error) {
    if (error instanceof PlayriftboundRefusedError && !error.stopsRun) {
      return null;
    }
    throw error;
  }
}

/** Failures are collected, not thrown, so one bad event doesn't stop a recheck pass. */
export async function playriftboundDeepFetch(
  deps: PlayriftboundSyncDeps,
  tournamentId: string,
  startAt: Date,
): Promise<PlayriftboundDeepFetchResult> {
  const before = deps.client.requests;
  const result: PlayriftboundDeepFetchResult = {
    tournamentId,
    requests: 0,
    players: 0,
    matches: 0,
    acceptedPlayers: 0,
    skippedPlayers: 0,
    facts: null,
    complete: false,
    gone: false,
    errors: [],
  };

  let raw: unknown;
  let empty = false;
  try {
    const data = await deps.client.query<unknown>(DETAIL_QUERY, { tournamentId });
    const tournaments = record(data)?.competeTournaments;
    raw = Array.isArray(tournaments) ? tournaments[0] : undefined;
    empty = Array.isArray(tournaments) && tournaments.length === 0;
  } catch (error) {
    if (isRunStopping(error)) {
      throw error;
    }
    result.errors.push(`Event ${tournamentId} detail: ${failure(error)}`);
    result.requests = deps.client.requests - before;
    return result;
  }
  result.requests = deps.client.requests - before;

  const detail = projectTournamentDetail(raw);
  if (detail === null) {
    result.gone = empty;
    result.errors.push(`Event ${tournamentId}: the source returned no tournament.`);
    return result;
  }

  const fetchedAt = clock(deps);
  const finished = playriftboundDisplayStatus(detail.facts, startAt, fetchedAt) === "complete";
  await deps.repos.playriftboundResults.replaceResults(tournamentId, {
    standings: detail.standings.map((row) => ({ ...row, tournamentId, fetchedAt })),
    phases: phasesToStore(detail.phases, finished).map((row) => ({ ...row, tournamentId })),
    matches: detail.matches.map((row) => ({ ...row, tournamentId })),
  });
  await deps.repos.playriftboundEvents.setDetailFacts(tournamentId, detail.facts, fetchedAt);
  result.players = detail.standings.length;
  result.matches = detail.matches.length;
  result.facts = detail.facts;
  result.complete = true;

  const source = await deps.repos.meta.sourceByKey(PLAYRIFTBOUND_PROVIDER, tournamentId);
  if (source !== undefined) {
    const promoted = await promoteMetaEvent(deps.repos, source.metaEventId);
    result.acceptedPlayers = promoted.players;
    result.skippedPlayers = promoted.unresolvedNames.length;
    result.errors.push(...promoted.errors);
  }
  return result;
}
