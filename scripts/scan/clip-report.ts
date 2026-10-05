import type { AcceptOptions } from "../../packages/shared/src/scan/accept.js";
import type {
  AppScore,
  BenchClipResult,
  ClipTruth,
} from "../../packages/shared/src/scan/bench-score.js";
import { summarize } from "../../packages/shared/src/scan/bench-score.js";
import type { PlacementStats } from "./placement-stats";
import { formatPlacement } from "./placement-stats";

export interface Sighting {
  key: string;
  label: string;
  firstSeen: number;
  count: number;
}

interface Attribution {
  top: number;
  plausible: number;
  bestScore: number;
  winners: number;
}

export interface ClipReplay {
  result: BenchClipResult & { app: AppScore };
  truth: ClipTruth;
  skipped: number;
  suppressedRelocks: number;
  refusedFrames: number;
  sweepFrames: number;
  stillFrames: number;
  /** Seconds. */
  boardReads: number[];
  placements: number;
  missedPlacements: number;
  catchUpRuns: number;
  recoveredAsk: number;
  placement: PlacementStats;
  attribution: Map<string, Attribution>;
  sightings: Sighting[];
  nearLocks: { firstSeen: number; label: string; sightings: number; maxRunLength: number }[];
}

export interface ReportOptions {
  accept?: AcceptOptions;
  attribute: boolean;
  catchUp: boolean;
  verbose: boolean;
}

function attributionLines(replay: ClipReplay): string {
  let lines = "";
  for (const name of new Set(replay.result.score.missed)) {
    const card = replay.truth.cards.find((entry) => entry.name === name);
    const stats = card ? replay.attribution.get(card.artKey) : undefined;
    let verdict = "NEVER RANKED FIRST (finding or crop)";
    if (stats && stats.plausible === 0) {
      verdict = "ranked first only at implausible distance (crop quality)";
    } else if (stats && stats.winners === 0) {
      verdict = "ranked first but never verified (aligned check)";
    } else if (stats) {
      verdict = "verified frames but no lock (accept rules)";
    }
    lines +=
      `    ATTR ${name.padEnd(28)} top ${String(stats?.top ?? 0).padStart(4)} ` +
      `plausible ${String(stats?.plausible ?? 0).padStart(4)} ` +
      `best-score ${String(stats?.bestScore ?? 0).padStart(3)} ` +
      `verified ${String(stats?.winners ?? 0).padStart(3)}  ${verdict}\n`;
  }
  return lines;
}

export function reportClip(replay: ClipReplay, options: ReportOptions): void {
  const { result, truth } = replay;
  const { score, app } = result;
  const { accept } = options;
  const aim = summarize(score.arrivalToLock);
  const arrival =
    score.arrivalToLock.length > 0
      ? `, arrival-to-lock p50 ${aim.p50.toFixed(2)}s p90 ${aim.p90.toFixed(2)}s`
      : "";
  const missed =
    (score.missed.length > 0 ? `  missed: ${score.missed.join(", ")}\n` : "") +
    (options.attribute ? attributionLines(replay) : "");
  const boardReadsAt =
    replay.boardReads.length > 0
      ? ` at ${replay.boardReads.map((at) => `${at.toFixed(1)}s`).join(", ")}`
      : "";
  process.stdout.write(
    `\n${result.clip} [${truth.split}, ${truth.mode}${truth.reviewed ? "" : ", UNREVIEWED"}]: ` +
      `${result.frames} frames, ${result.processed} processed, ${replay.skipped} skipped, ` +
      `${result.frameMs.mean.toFixed(0)}ms/frame (p90 ${result.frameMs.p90.toFixed(0)})\n` +
      `  SCORE found ${score.found}/${score.expected}, wrong card ${score.wrongCards}, ` +
      `wrong printing ${score.wrongPrintings}, marker only ${score.markerOnly}, ` +
      `printing open ${score.printingOpen}, duplicates ${score.duplicates}${arrival}\n` +
      `  APP added ${app.auto - app.autoWrong} right, ${app.autoWrong} wrong, ` +
      `${app.markerMiss} only the marker missed; ` +
      `picker ${app.picker} (${app.pickerMissing} without the right printing)\n${missed}` +
      `${formatPlacement(replay.placement)}` +
      `  accept layer (run ${accept?.lockRun}, gap ${accept?.maxGapFrames}): ` +
      `${result.locks.length} locks, ${replay.suppressedRelocks} re-locks suppressed, ` +
      `${replay.refusedFrames} frames refused, ${replay.sweepFrames} sweep frames, ` +
      `${replay.stillFrames} still frames\n` +
      `  placements: detector saw ${replay.placements}, ${replay.missedPlacements} went unlocked, ` +
      `${replay.catchUpRuns} second looks run, ` +
      `${replay.recoveredAsk} left for the user${options.catchUp ? "" : " (second look OFF)"}\n` +
      `  board reads: ${replay.boardReads.length}${boardReadsAt}\n`,
  );
  for (const lock of result.locks) {
    const flag = lock.verdict === "correct" ? "" : `  <-- ${lock.verdict.toUpperCase()}`;
    process.stdout.write(
      `    lock ${lock.seconds.toFixed(1).padStart(5)}s  ${lock.label.padEnd(46)} ` +
        `after ${String(lock.framesToLock).padStart(3)} frames, ` +
        `score ${lock.score} vs rival ${lock.rivalScore}` +
        `${lock.source === "second-look" ? " (second look)" : ""}${flag}\n`,
    );
  }
  if (!options.verbose) {
    return;
  }
  for (const sighting of replay.sightings) {
    process.stdout.write(
      `    seen ${sighting.firstSeen.toFixed(1).padStart(5)}s  ${sighting.label.padEnd(46)} ` +
        `${String(sighting.count).padStart(3)}x\n`,
    );
  }
  for (const near of replay.nearLocks) {
    process.stdout.write(
      `    near ${near.firstSeen.toFixed(1).padStart(5)}s  ${near.label.padEnd(46)} ` +
        `seen ${String(near.sightings).padStart(3)}x, best run ${near.maxRunLength}\n`,
    );
  }
}
