// Match results are entered game by game and stored as games won per side plus
// the pod's drawn games; the server derives placement and match points.

import {
  placementsFromGamePoints,
  swissPointsForPlacements,
} from "@openrift/shared/pairing/points";
import type { TournamentMatchFormat } from "@openrift/shared/types/api/tournament";

export interface PodResultEntry {
  playerId: string;
  gamePoints: number;
}

export interface PodResultSubmission {
  results: PodResultEntry[];
  drawnGames?: number;
}

export type GameOutcome = "first" | "second" | "draw" | "unplayed";

export type GameRows = (GameOutcome | null)[];

export interface MatchCounts {
  gamePoints: [number, number];
  drawnGames: number;
}

export const INTENTIONAL_DRAW: MatchCounts = { gamePoints: [0, 0], drawnGames: 3 };

function gameCount(matchFormat: TournamentMatchFormat): number {
  return matchFormat === "bo1" ? 1 : 3;
}

function winsNeeded(matchFormat: TournamentMatchFormat): number {
  return matchFormat === "bo1" ? 1 : 2;
}

export function emptyGameRows(matchFormat: TournamentMatchFormat): GameRows {
  return Array.from({ length: gameCount(matchFormat) }, () => null);
}

function decidedBefore(rows: GameRows, index: number, matchFormat: TournamentMatchFormat): boolean {
  const before = rows.slice(0, index);
  const needed = winsNeeded(matchFormat);
  return (
    before.filter((game) => game === "first").length >= needed ||
    before.filter((game) => game === "second").length >= needed
  );
}

export function visibleGameCount(rows: GameRows, matchFormat: TournamentMatchFormat): number {
  let visible = 1;
  while (visible < rows.length) {
    const previous = rows[visible - 1];
    if (previous === null || previous === "unplayed" || decidedBefore(rows, visible, matchFormat)) {
      break;
    }
    visible += 1;
  }
  return visible;
}

export function setGame(
  rows: GameRows,
  index: number,
  outcome: GameOutcome,
  matchFormat: TournamentMatchFormat,
): GameRows {
  const next = rows.map((game, gameIndex) => (gameIndex === index ? outcome : game));
  const visible = visibleGameCount(next, matchFormat);
  return next.map((game, gameIndex) => (gameIndex < visible ? game : null));
}

export function clearGame(rows: GameRows, index: number): GameRows {
  return rows.map((game, gameIndex) => (gameIndex < index ? game : null));
}

/** Ends the match at its first open game; null when no game after the first is open. */
export function endAtOpenGame(rows: GameRows, matchFormat: TournamentMatchFormat): GameRows | null {
  const open = rows.slice(0, visibleGameCount(rows, matchFormat)).indexOf(null);
  return open > 0 ? setGame(rows, open, "unplayed", matchFormat) : null;
}

export function withoutUnplayed(rows: GameRows): GameRows {
  return rows.map((game) => (game === "unplayed" ? null : game));
}

export function countsFromGames(
  rows: GameRows,
  matchFormat: TournamentMatchFormat,
  allowDraws: boolean,
): MatchCounts | null {
  const shown = rows.slice(0, visibleGameCount(rows, matchFormat));
  if (shown.some((game) => game === null) || shown[0] === "unplayed") {
    return null;
  }
  const first = shown.filter((game) => game === "first").length;
  const second = shown.filter((game) => game === "second").length;
  if (!allowDraws && first === second) {
    return null;
  }
  return {
    gamePoints: [first, second],
    drawnGames: shown.filter((game) => game === "draw").length,
  };
}

/** Null when the rows cannot express the result. */
export function gamesFromCounts(
  counts: MatchCounts,
  matchFormat: TournamentMatchFormat,
  allowDraws: boolean,
): GameRows | null {
  const [first, second] = counts.gamePoints;
  const draws = counts.drawnGames;
  const total = gameCount(matchFormat);
  const needed = winsNeeded(matchFormat);
  if (
    first + second + draws === 0 ||
    first + second + draws > total ||
    (first >= needed && second >= needed) ||
    (!allowDraws && (draws > 0 || first === second))
  ) {
    return null;
  }
  const winner: GameOutcome = first > second ? "first" : "second";
  const loser: GameOutcome = winner === "first" ? "second" : "first";
  const played: GameOutcome[] = [
    ...Array.from({ length: draws }, (): GameOutcome => "draw"),
    ...Array.from({ length: Math.min(first, second) }, () => loser),
    ...Array.from({ length: Math.max(first, second) }, () => winner),
  ];
  let rows: GameRows = emptyGameRows(matchFormat);
  for (const [index, outcome] of played.entries()) {
    rows = setGame(rows, index, outcome, matchFormat);
  }
  if (played.length < total && visibleGameCount(rows, matchFormat) > played.length) {
    rows = setGame(rows, played.length, "unplayed", matchFormat);
  }
  return countsFromGames(rows, matchFormat, allowDraws) === null ? null : rows;
}

export function swissPointsPreview(
  gamePoints: [number, number],
  winPoints: number,
  drawPoints: number,
): [number, number] {
  const points = swissPointsForPlacements(
    placementsFromGamePoints([...gamePoints]),
    winPoints,
    drawPoints,
  );
  return [points[0] ?? 0, points[1] ?? 0];
}
