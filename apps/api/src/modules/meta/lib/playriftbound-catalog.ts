import { WellKnown } from "@openrift/shared/well-known";

import { stableKey } from "../../../lib/hash.js";
import { coord, count, instant, record, text } from "../../../lib/json-coerce.js";

/**
 * The source publishes a GraphQL schema we cannot introspect, so every field is
 * read defensively. A row with no usable id, name or start is dropped.
 */

export function playriftboundFormat(sourceFormat: string | null): string {
  return sourceFormat === "CONSTRUCTED"
    ? WellKnown.deckFormat.CONSTRUCTED
    : WellKnown.deckFormat.FREEFORM;
}

const ONE_V_ONE = "ONE_V_ONE";

export function isTeamFormat(playerFormat: string | null): boolean {
  return playerFormat !== null && playerFormat !== ONE_V_ONE;
}

const TOURNAMENT_ID = /^\d+$/u;

function tournamentIdOf(value: unknown): string | null {
  const raw = text(value);
  return raw !== null && TOURNAMENT_ID.test(raw) ? raw : null;
}

export interface PlayriftboundOrganizerProjection {
  id: string;
  name: string;
  city: string | null;
  adminArea: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface PlayriftboundEventProjection {
  tournamentId: string;
  organizerId: string | null;
  name: string;
  startAt: Date;
  tournamentType: string | null;
  format: string | null;
  playerFormat: string | null;
  participantCapacity: number | null;
  registeredCount: number | null;
  waitlistedCount: number | null;
  pricing: string | null;
  entryFeeCurrency: string | null;
  entryFeeMinor: number | null;
  contentHash: string;
}

/** The parts array's field order must stay fixed, or unrelated diffs hash as content changes. */
function playriftboundContentHash(
  fields: Omit<PlayriftboundEventProjection, "contentHash">,
): string {
  const parts = [
    fields.name,
    fields.organizerId ?? "",
    fields.startAt.toISOString(),
    fields.tournamentType ?? "",
    fields.format ?? "",
    fields.playerFormat ?? "",
    fields.participantCapacity === null ? "" : String(fields.participantCapacity),
    fields.registeredCount === null ? "" : String(fields.registeredCount),
    fields.waitlistedCount === null ? "" : String(fields.waitlistedCount),
    fields.pricing ?? "",
    fields.entryFeeCurrency ?? "",
    fields.entryFeeMinor === null ? "" : String(fields.entryFeeMinor),
  ];
  return stableKey(parts, 32);
}

function latitude(value: unknown): number | null {
  const n = coord(value);
  return n !== null && n >= -90 && n <= 90 ? n : null;
}

function longitude(value: unknown): number | null {
  const n = coord(value);
  return n !== null && n >= -180 && n <= 180 ? n : null;
}

function projectOrganizer(raw: unknown): PlayriftboundOrganizerProjection | null {
  const row = record(raw);
  const id = text(row?.id);
  const name = text(row?.name);
  if (row === null || id === null || name === null) {
    return null;
  }
  const address = record(row.physicalAddress);
  return {
    id,
    name: name.slice(0, 200),
    city: text(address?.city),
    adminArea: text(address?.adminArea1),
    address: text(address?.formattedAddress),
    latitude: latitude(address?.latitude),
    longitude: longitude(address?.longitude),
  };
}

function registrantCount(value: unknown, status: string): number | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const entry = value.map((row) => record(row)).find((row) => row?.status === status);
  return entry === undefined ? 0 : count(entry?.count);
}

/** One `CompeteTournamentSearch` edge node. */
export function projectSearchResult(raw: unknown): {
  event: PlayriftboundEventProjection;
  organizer: PlayriftboundOrganizerProjection | null;
} | null {
  const node = record(raw);
  const tournament = record(node?.tournament);
  const tournamentId = tournamentIdOf(tournament?.id);
  const name = text(tournament?.name);
  const startAt = instant(tournament?.startsAt);
  if (tournament === null || tournamentId === null || name === null || startAt === null) {
    return null;
  }
  const organizer = projectOrganizer(node?.organizer);
  const config = record(tournament.config);
  const fee = record(tournament.entryFee);
  const fields = {
    tournamentId,
    organizerId: organizer?.id ?? null,
    name: name.slice(0, 200),
    startAt,
    tournamentType: text(config?.tournamentType),
    format: text(config?.format),
    playerFormat: text(config?.playerFormat),
    participantCapacity: count(config?.participantCapacity),
    registeredCount: registrantCount(tournament.registrantCounts, "REGISTERED"),
    waitlistedCount: registrantCount(tournament.registrantCounts, "WAITLISTED"),
    pricing: text(tournament.pricing),
    entryFeeCurrency: text(fee?.currency),
    entryFeeMinor: count(fee?.minorUnits),
  };
  return { event: { ...fields, contentHash: playriftboundContentHash(fields) }, organizer };
}

interface PlayriftboundStandingProjection {
  teamId: string;
  playerId: string | null;
  playerName: string;
  rank: number | null;
  wins: number | null;
  losses: number | null;
  draws: number | null;
  matchPoints: number | null;
  opponentMatchWinPct: number | null;
  gameWinPct: number | null;
  opponentGameWinPct: number | null;
  entryStatus: "dropped" | null;
}

export interface PlayriftboundPhaseProjection {
  phaseOrder: number;
  name: string | null;
  roundType: string;
  roundCount: number | null;
  maxGameWins: number | null;
  roundsPlayed: number;
}

interface PlayriftboundMatchProjection {
  sourceMatchId: string;
  roundId: string;
  phaseOrder: number;
  roundNumber: number;
  tableNumber: number | null;
  isBye: boolean;
  isDraw: boolean;
  player1TeamId: string;
  player2TeamId: string | null;
  winnerTeamId: string | null;
  gamesWonP1: number | null;
  gamesWonP2: number | null;
}

export interface PlayriftboundDetailFacts {
  structure: string | null;
  matchFormat: string | null;
  roundCount: number | null;
  roundsPlayed: number;
  roundsFinalized: number;
  sourceUpdatedAt: Date | null;
}

export interface PlayriftboundDetailProjection {
  facts: PlayriftboundDetailFacts;
  standings: PlayriftboundStandingProjection[];
  phases: PlayriftboundPhaseProjection[];
  matches: PlayriftboundMatchProjection[];
}

const FINALIZED = "FINALIZED";

function list(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.map((row) => record(row)).filter((row): row is Record<string, unknown> => row !== null)
    : [];
}

/** The source sends tiebreakers as decimal strings (`"0.4444444444444444"`). */
function fraction(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1 ? n : null;
}

function positive(value: unknown): number | null {
  const n = count(value);
  return n === null || n === 0 ? null : n;
}

function maxGameWins(matchFormat: string | null): number | null {
  if (matchFormat === "BO1") {
    return 1;
  }
  if (matchFormat === "BO3") {
    return 2;
  }
  return null;
}

/** `meta-standings` recognises an elimination phase by the word SINGLE_ELIMINATION. */
function stageRoundType(structure: string | null, index: number): string {
  if (structure === "SINGLE_ELIM" || (structure === "SWISS_PLUS_SINGLE_ELIM" && index > 0)) {
    return "SINGLE_ELIMINATION";
  }
  return "SWISS";
}

interface RoundRef {
  phaseOrder: number;
  sectionIndex: number;
  roundNumber: number;
  roundId: string;
  round: Record<string, unknown>;
}

function roundsOf(stages: readonly Record<string, unknown>[]): RoundRef[] {
  const rounds: RoundRef[] = [];
  for (const [phaseOrder, stage] of stages.entries()) {
    const stageId = text(stage.esportsStageId) ?? String(phaseOrder);
    for (const [sectionIndex, section] of list(stage.sections).entries()) {
      const sectionId = text(section.esportsSectionId) ?? String(sectionIndex);
      for (const round of list(section.rounds)) {
        const roundNumber = positive(round.roundNumber);
        if (roundNumber !== null) {
          rounds.push({
            phaseOrder,
            sectionIndex,
            roundNumber,
            roundId: `${stageId}:${sectionId}:${roundNumber}`,
            round,
          });
        }
      }
    }
  }
  // Later rounds overwrite earlier standings, so the order cannot be left to the payload.
  return rounds.toSorted(
    (a, b) =>
      a.phaseOrder - b.phaseOrder ||
      a.sectionIndex - b.sectionIndex ||
      a.roundNumber - b.roundNumber,
  );
}

function teamIdsOf(match: Record<string, unknown>): string[] {
  return list(match.teams)
    .map((team) => text(team.esportsTeamId))
    .filter((id): id is string => id !== null);
}

function outcomeOf(outcomes: unknown, teamId: string): string | null {
  return text(list(outcomes).find((row) => text(row.esportsTeamId) === teamId)?.outcome);
}

function projectMatch(
  ref: RoundRef,
  match: Record<string, unknown>,
): PlayriftboundMatchProjection | null {
  const sourceMatchId = text(match.esportsMatchId);
  const [first, second = null, ...rest] = teamIdsOf(match);
  if (sourceMatchId === null || first === undefined || rest.length > 0) {
    return null;
  }
  const outcomes = match.teamOutcomes;
  const firstOutcome = outcomeOf(outcomes, first);
  if (firstOutcome === null) {
    return null;
  }
  const games = list(match.games);
  const gamesWon = (teamId: string) =>
    games.filter((game) => outcomeOf(game.teamOutcomes, teamId) === "WIN").length;
  let winnerTeamId: string | null = null;
  if (firstOutcome === "WIN") {
    winnerTeamId = first;
  } else if (second !== null && outcomeOf(outcomes, second) === "WIN") {
    winnerTeamId = second;
  }
  return {
    sourceMatchId,
    roundId: ref.roundId,
    phaseOrder: ref.phaseOrder,
    roundNumber: ref.roundNumber,
    tableNumber: positive(match.tableNumber),
    isBye: second === null,
    isDraw: second !== null && firstOutcome === "TIE",
    player1TeamId: first,
    player2TeamId: second,
    winnerTeamId: second === null ? first : winnerTeamId,
    gamesWonP1: games.length === 0 ? null : gamesWon(first),
    gamesWonP2: second === null || games.length === 0 ? null : gamesWon(second),
  };
}

/**
 * Each team's latest standing: elimination rounds list only the players still
 * in them, while the source keeps dropped players in every later Swiss round.
 */
function latestStandings(rounds: readonly RoundRef[]): Map<string, Record<string, unknown>> {
  const byTeam = new Map<string, Record<string, unknown>>();
  for (const ref of rounds) {
    for (const row of list(ref.round.endOfRoundStandings)) {
      const teamId = text(row.esportsTeamId);
      if (teamId !== null) {
        byTeam.set(teamId, row);
      }
    }
  }
  return byTeam;
}

// A Riot ID is `gameName#tagLine`; only the game name is ever stored.
function gameName(value: unknown): string | null {
  return text(text(value)?.replace(/#.*$/u, ""));
}

function projectStandings(
  tournament: Record<string, unknown>,
  rounds: readonly RoundRef[],
): PlayriftboundStandingProjection[] {
  const byTeam = Map.groupBy(
    list(tournament.tournamentParticipants).filter((row) => text(row.esportsTeamId) !== null),
    (row) => text(row.esportsTeamId) as string,
  );
  const standingByTeam = latestStandings(rounds);
  const projections: PlayriftboundStandingProjection[] = [];
  for (const [teamId, members] of byTeam) {
    const players = members.map((member) => record(member.player));
    const names = players.map((player) => gameName(player?.displayName)).filter((n) => n !== null);
    if (names.length === 0) {
      continue;
    }
    const standing = standingByTeam.get(teamId);
    projections.push({
      teamId,
      playerId: players.length === 1 ? text(players[0]?.id) : null,
      playerName: names.join(" / ").slice(0, 80),
      rank: positive(standing?.rank),
      wins: count(standing?.matchWins),
      losses: count(standing?.matchLosses),
      draws: count(standing?.matchDraws),
      matchPoints: count(standing?.matchPoints),
      opponentMatchWinPct: fraction(standing?.opponentMatchWinPercentage),
      gameWinPct: fraction(standing?.gameWinPercentage),
      opponentGameWinPct: fraction(standing?.opponentGameWinPercentage),
      entryStatus: members.every((member) => member.status === "DROPPED") ? "dropped" : null,
    });
  }
  return projections;
}

/** One `GetCompeteTournamentForRiftboundPlayer` tournament. */
export function projectTournamentDetail(raw: unknown): PlayriftboundDetailProjection | null {
  const tournament = record(raw);
  if (tournament === null || tournamentIdOf(tournament.id) === null) {
    return null;
  }
  const config = record(tournament.config);
  const structure = text(config?.structure);
  const matchFormat = text(config?.matchFormat);
  const stages = list(tournament.stages);
  const rounds = roundsOf(stages);

  const matches: PlayriftboundMatchProjection[] = [];
  for (const ref of rounds) {
    for (const match of list(ref.round.matches)) {
      const projected = projectMatch(ref, match);
      if (projected !== null) {
        matches.push(projected);
      }
    }
    const byes = Array.isArray(ref.round.byeTeamIds) ? ref.round.byeTeamIds : [];
    const seated = new Set(
      matches
        .filter((match) => match.roundId === ref.roundId && match.isBye)
        .map((match) => match.player1TeamId),
    );
    for (const teamId of byes.map((id) => text(id)).filter((id) => id !== null)) {
      if (seated.has(teamId)) {
        continue;
      }
      matches.push({
        sourceMatchId: `bye:${ref.roundId}:${teamId}`,
        roundId: ref.roundId,
        phaseOrder: ref.phaseOrder,
        roundNumber: ref.roundNumber,
        tableNumber: null,
        isBye: true,
        isDraw: false,
        player1TeamId: teamId,
        player2TeamId: null,
        winnerTeamId: teamId,
        gamesWonP1: null,
        gamesWonP2: null,
      });
    }
  }

  const roundCount = positive(config?.roundCount);
  const phases = stages.map((stage, index) => {
    const roundType = stageRoundType(structure, index);
    const observed = rounds.filter((ref) => ref.phaseOrder === index).length;
    return {
      phaseOrder: index,
      name: text(stage.name)?.slice(0, 120) ?? null,
      roundType,
      roundCount: roundType === "SWISS" && roundCount !== null ? roundCount : observed || null,
      maxGameWins: maxGameWins(matchFormat),
      roundsPlayed: observed,
    };
  });

  return {
    facts: {
      structure,
      matchFormat,
      roundCount,
      roundsPlayed: rounds.length,
      roundsFinalized: rounds.filter((ref) => ref.round.status === FINALIZED).length,
      sourceUpdatedAt: instant(tournament.updatedAt),
    },
    standings: projectStandings(tournament, rounds),
    phases,
    matches,
  };
}

/** Stores often stop short of the planned rounds, so a finished phase stores what it played. */
export function phasesToStore(
  phases: readonly PlayriftboundPhaseProjection[],
  finished: boolean,
): Omit<PlayriftboundPhaseProjection, "roundsPlayed">[] {
  return phases.map(({ roundsPlayed, ...phase }) => ({
    ...phase,
    roundCount: finished && roundsPlayed > 0 ? roundsPlayed : phase.roundCount,
  }));
}

const QUIET_MS = 6 * 60 * 60 * 1000;

const ABANDONED_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * The source has no "finished" flag. Stores stop short of the planned rounds
 * and leave rounds open for good, so quiet and age both count as finished.
 */
export function playriftboundDisplayStatus(
  facts: Pick<
    PlayriftboundDetailFacts,
    "structure" | "roundCount" | "roundsPlayed" | "roundsFinalized" | "sourceUpdatedAt"
  >,
  startAt: Date,
  now: Date,
): "complete" | "inProgress" | "upcoming" {
  if (startAt.getTime() > now.getTime()) {
    return "upcoming";
  }
  if (now.getTime() - startAt.getTime() >= ABANDONED_MS) {
    return "complete";
  }
  const allFinalized = facts.roundsPlayed > 0 && facts.roundsFinalized === facts.roundsPlayed;
  const reachedPlan =
    facts.structure !== "SWISS_PLUS_SINGLE_ELIM" &&
    facts.roundCount !== null &&
    facts.roundsFinalized >= facts.roundCount;
  const quiet =
    facts.sourceUpdatedAt !== null && now.getTime() - facts.sourceUpdatedAt.getTime() >= QUIET_MS;
  return allFinalized && (reachedPlan || quiet) ? "complete" : "inProgress";
}

export const SEARCH_RADIUS_METERS = 160_934;

const CELL_KM = 210;
const KM_PER_DEGREE = 111.195;
const LAT_STEP = CELL_KM / KM_PER_DEGREE;

export interface PlayriftboundCell {
  key: string;
  latitude: number;
  longitude: number;
}

function rowCenter(row: number): number {
  return -90 + (row + 0.5) * LAT_STEP;
}

function columnsIn(row: number): number {
  const widthKm = 360 * KM_PER_DEGREE * Math.cos((rowCenter(row) * Math.PI) / 180);
  return Math.max(1, Math.floor(widthKm / CELL_KM));
}

function cellAt(row: number, column: number): PlayriftboundCell {
  const step = 360 / columnsIn(row);
  return {
    key: `${row}:${column}`,
    latitude: rowCenter(row),
    longitude: -180 + (column + 0.5) * step,
  };
}

/** The search answers within 100 miles of a point; one circle covers one cell. */
export function cellOf(lat: number, lng: number): PlayriftboundCell {
  const row = Math.min(Math.floor((lat + 90) / LAT_STEP), Math.floor(180 / LAT_STEP) - 1);
  const columns = columnsIn(row);
  const column = Math.min(Math.floor(((lng + 180) / 360) * columns), columns - 1);
  return cellAt(row, column);
}

/** Every cell between two latitudes, south to north and west to east. */
export function cellsBetween(southLat: number, northLat: number): PlayriftboundCell[] {
  const cells: PlayriftboundCell[] = [];
  const first = Math.floor((southLat + 90) / LAT_STEP);
  const last = Math.floor((northLat + 90) / LAT_STEP);
  for (let row = first; row <= last; row++) {
    for (let column = 0; column < columnsIn(row); column++) {
      cells.push(cellAt(row, column));
    }
  }
  return cells;
}
