import type {
  PodStandingsSnapshot,
  PodTournamentDetailResponse,
} from "@openrift/shared/types/api/pod-tournament";

import type { Repos } from "../../../deps.js";
import type { PodRoundRows } from "../repositories/pod-tournaments-rounds.js";
import type { Tournament } from "../repositories/tournaments-shared.js";
import { buildGroupStageBundle } from "./group-cut-builders.js";
import { isGroupCut } from "./group-cut.js";
import { scoringOf } from "./pod-scoring.js";
import { toRoundResponse } from "./pod-tournament-presenters.js";
import { loadTournament } from "./tournament-access.js";
import { toPodPlayer, toPodTournament } from "./tournament-presenters.js";

/**
 * Group rounds stay "reporting" until the cut is generated, so for that format a
 * round counts as done once every pod is reported; elsewhere it must be finalized.
 */
function roundDone(rows: PodRoundRows, groupCut: boolean): boolean {
  return (
    rows.round.status === "finalized" ||
    (groupCut &&
      rows.pods.length > 0 &&
      rows.pods.every((pod) => pod.pod.resultStatus === "reported"))
  );
}

/** The tournament as it stood after `throughRound`; a missing or too-high value means the latest done round. */
export async function buildStandingsSnapshot(
  repos: Repos,
  tournament: Tournament,
  throughRound?: number,
): Promise<PodStandingsSnapshot> {
  const scoring = scoringOf(tournament);
  const groupCut = isGroupCut(tournament);
  const [players, roundRows] = await Promise.all([
    repos.podTournaments.listPlayers(tournament.id),
    repos.podTournaments.loadRounds(tournament.id),
  ]);
  const latestRound = roundRows.reduce(
    (highest, rows) =>
      roundDone(rows, groupCut) ? Math.max(highest, rows.round.roundNumber) : highest,
    0,
  );
  const cutoff = throughRound === undefined ? latestRound : Math.min(throughRound, latestRound);
  const included = roundRows.filter((rows) => rows.round.roundNumber <= cutoff);
  const [standings, groupStage] = await Promise.all([
    repos.podTournaments.computeStandings(tournament.id, scoring, cutoff),
    buildGroupStageBundle(repos, tournament, players, included),
  ]);
  return {
    throughRound: cutoff,
    latestRound,
    standings,
    rounds: included.map((rows) => toRoundResponse(rows, scoring)),
    groupStage: groupStage.groupStage,
  };
}

export async function buildPodRunDetail(
  repos: Repos,
  tournament: Tournament,
): Promise<PodTournamentDetailResponse> {
  const scoring = scoringOf(tournament);
  const [players, standings, roundRows, openRound] = await Promise.all([
    repos.podTournaments.listPlayers(tournament.id),
    repos.podTournaments.computeStandings(tournament.id, scoring),
    repos.podTournaments.loadRounds(tournament.id),
    repos.podTournaments.findOpenRound(tournament.id),
  ]);
  const openRoundSnapshot = openRound
    ? await repos.podTournaments.loadOpenRoundSnapshot(tournament.id, scoring)
    : null;
  const groupStage = await buildGroupStageBundle(repos, tournament, players, roundRows);
  return {
    tournament: toPodTournament(tournament),
    players: players.map((player) => toPodPlayer(player)),
    standings,
    rounds: roundRows.map((rows) => toRoundResponse(rows, scoring)),
    openRoundSnapshot,
    groupStage: groupStage.groupStage,
    legendMetaShares: groupStage.legendMetaShares,
  };
}

export async function podRunDetailById(
  repos: Repos,
  id: string,
): Promise<PodTournamentDetailResponse> {
  return buildPodRunDetail(repos, await loadTournament(repos, id));
}
