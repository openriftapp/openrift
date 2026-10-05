/**
 * The per-frame diagnostics: the devtools vite plugin pipes them to the
 * terminal, so phone runs can be watched from the dev-server log.
 */

import type { FrameOutcome } from "@openrift/shared/scan/session";

const PRINTING_SCORES_SHOWN = 4;

export function frameLogLine(
  frameIndex: number,
  outcome: FrameOutcome,
  aimAgeSeconds: number,
): string {
  const timings = outcome.timings;
  const top = outcome.ranked[0];
  const topPart = top
    ? ` top ${top.key} d${top.distance.toFixed(3)} r${top.rotation} aim ${aimAgeSeconds.toFixed(1)}s`
    : " no-candidate";
  const winnerPart = outcome.winner
    ? ` winner ${outcome.winner.key} score ${outcome.winner.score} rival ${outcome.winner.rivalScore}`
    : `${outcome.refused ? " refused" : ""}${
        outcome.bestScore > 0 ? ` best-score ${outcome.bestScore}` : ""
      }`;
  return `[scan] #${frameIndex} ${timings.total.toFixed(0)}ms (detect ${timings.detect.toFixed(0)}, embed ${timings.embed.toFixed(0)}, verify ${timings.verify.toFixed(0)}) focus ${outcome.focus.toFixed(0)}${topPart}${winnerPart}`;
}

export function printingLogLine(outcome: FrameOutcome): string | null {
  const update = outcome.printingTrack;
  if (!update || !outcome.printingScores) {
    return null;
  }
  const summary = outcome.printingScores
    .slice(0, PRINTING_SCORES_SHOWN)
    .map((entry) => `${entry.key.slice(0, 8)}=${entry.score.toFixed(3)}`)
    .join(" ");
  const verdict =
    outcome.printingMargin === undefined
      ? "abstained"
      : `picked via ${outcome.printingVia} margin ${outcome.printingMargin.toFixed(3)}`;
  return `[scan] PRINTING ${update.label} ${verdict} | band ${summary}`;
}
