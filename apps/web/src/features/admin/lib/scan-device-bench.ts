import { lockIdOf } from "@openrift/shared/scan/accept";
import type { BenchLock, TimingSummary } from "@openrift/shared/scan/bench-score";
import { summarize } from "@openrift/shared/scan/bench-score";
import type { BoardCard } from "@openrift/shared/scan/board";
import type { PlacementSignal } from "@openrift/shared/scan/placement";
import type { FrameOutcome } from "@openrift/shared/scan/session";
import type { Quad, RgbaImage } from "@openrift/shared/scan/types";

import type { PendingFrame } from "@/features/scan/lib/scan-catchup";
import {
  catchUpVerdict,
  createCatchUpQueue,
  shouldRunCatchUp,
} from "@/features/scan/lib/scan-catchup";
import type { BoardReadResult, FrameDecision } from "@/features/scan/lib/scan-loop";
import { createScanLoop } from "@/features/scan/lib/scan-loop";
import { IDLE_PACE_DELAY_MS, shouldPaceFrame } from "@/features/scan/lib/scan-pacing";
import { createScanRun } from "@/features/scan/lib/scan-run";

export interface ReplayPacing {
  ready: (index: number, seconds: number) => boolean;
  ran: (step: { index: number; seconds: number; elapsedMs: number; idlePaced: boolean }) => void;
}

export function everyNthFrame(stride: number): ReplayPacing {
  let next = 0;
  return {
    ready: (index) => index >= next,
    ran: ({ index }) => {
      next = index + stride;
    },
  };
}

/** Processes the frames a phone processed while recording, given their grab times in seconds. */
export function recordedPacing(grabs: readonly number[], fps: number): ReplayPacing {
  const halfFrame = 0.5 / fps;
  let next = 0;
  return {
    ready: (_index, seconds) => {
      const due = grabs[next];
      if (due === undefined || seconds + halfFrame < due) {
        return false;
      }
      while ((grabs[next] ?? Infinity) <= seconds + halfFrame) {
        next++;
      }
      return true;
    },
    ran: () => null,
  };
}

export function realtimePacing(): ReplayPacing {
  let busyUntil = 0;
  return {
    ready: (_index, seconds) => seconds >= busyUntil,
    ran: ({ seconds, elapsedMs, idlePaced }) => {
      busyUntil = seconds + (elapsedMs + (idlePaced ? IDLE_PACE_DELAY_MS : 0)) / 1000;
    },
  };
}

export interface ReplayBehaviour {
  rearm: boolean;
  skipDisturbed: boolean;
  relockGuard: boolean;
  boardReads: boolean;
}

const APP_BEHAVIOUR: ReplayBehaviour = {
  rearm: true,
  skipDisturbed: true,
  relockGuard: true,
  boardReads: true,
};

export interface ReplayFrame {
  index: number;
  seconds: number;
  /** Its pixels may already belong to `process`; only the size is safe to read. */
  frame: RgbaImage;
  outcome: FrameOutcome;
  decision: FrameDecision;
  board: BoardReadResult | null;
}

type ProcessFrame = (frame: RgbaImage, index: number, seconds: number) => Promise<FrameOutcome>;

export interface ReplayDeps {
  frameCount: number;
  fps: number;
  loadFrame: (index: number) => Promise<RgbaImage>;
  watch: (frame: RgbaImage) => PlacementSignal;
  /** Takes ownership of the frame; it must not be read afterwards. */
  process: ProcessFrame;
  catchUp?: ProcessFrame;
  readBoard?: (still: RgbaImage) => Promise<BoardCard[] | null>;
  loadStill?: (index: number) => Promise<RgbaImage>;
  rearm: () => void;
  multiPrinting: (artKey: string) => boolean;
  labelOf: (key: string) => string;
  idleGate: number;
  /** Milliseconds. */
  now: () => number;
  pacing: ReplayPacing;
  behaviour?: Partial<ReplayBehaviour>;
  onFrame?: (frame: ReplayFrame) => void;
}

export interface ReplayResult {
  processed: number;
  skipped: number;
  frameMs: number[];
  stageMs: { detect: number; embed: number; verify: number; printing: number };
  sweepShare: number;
  sweepFrames: number;
  stillFrames: number;
  suppressedRelocks: number;
  /** Seconds. */
  boardReads: number[];
  placements: number;
  missedPlacements: number;
  catchUpRuns: number;
  recoveredAsk: number;
  locks: BenchLock[];
}

function cardHeight([a, b, c, d]: Quad): number {
  return Math.round(Math.max(Math.hypot(d.x - a.x, d.y - a.y), Math.hypot(c.x - b.x, c.y - b.y)));
}

interface ReplayPending extends PendingFrame {
  arrivedAt: number;
}

/** Drives the app's frame loop (scan-loop.ts) over a clip. */
export async function replayClip(deps: ReplayDeps): Promise<ReplayResult> {
  const behaviour = { ...APP_BEHAVIOUR, ...deps.behaviour };
  const { pacing, catchUp } = deps;
  const run = createScanRun("single");
  const loop = createScanLoop<ReplayPending>({
    run: () => run,
    idleGate: () => deps.idleGate,
    readBoard: async (still) => (deps.readBoard ? await deps.readBoard(still) : null),
    relockGuard: behaviour.relockGuard,
  });
  const catchUpQueue = createCatchUpQueue();
  const catchUpArrivals = new Map<string, number>();
  const stageTotals = { detect: 0, embed: 0, verify: 0, printing: 0 };
  const result: Omit<ReplayResult, "stageMs" | "sweepShare"> = {
    processed: 0,
    skipped: 0,
    frameMs: [],
    sweepFrames: 0,
    stillFrames: 0,
    suppressedRelocks: 0,
    boardReads: [],
    placements: 0,
    missedPlacements: 0,
    catchUpRuns: 0,
    recoveredAsk: 0,
    locks: [],
  };
  const { locks } = result;
  const lastLockByArt = new Map<string, BenchLock>();

  let wasDisturbed = false;
  let lastArrivalAt: number | null = null;
  let enqueued = 0;

  function watchPlacement(frame: RgbaImage, signal: PlacementSignal, seconds: number): void {
    const now = seconds * 1000;
    const { missed, missedFrame, confirmed } = loop.observePlacement(signal, now, () =>
      catchUp
        ? {
            frame: { ...frame, data: new Uint8ClampedArray(frame.data) },
            thumbnail: null,
            arrivedAt: lastArrivalAt ?? seconds,
          }
        : null,
    );
    if (missed) {
      result.missedPlacements++;
    }
    if (missedFrame && catchUp) {
      enqueued++;
      const id = `catchup-${enqueued}`;
      catchUpArrivals.set(id, missedFrame.arrivedAt);
      catchUpQueue.push({ id, frame: missedFrame.frame, thumbnail: null, at: now });
    }
    if (confirmed) {
      result.placements++;
      if (behaviour.rearm) {
        deps.rearm();
      }
    }
  }

  async function runCatchUp(index: number, seconds: number): Promise<void> {
    const entry = catchUpQueue.take();
    if (!entry || !catchUp) {
      return;
    }
    const startedAt = deps.now();
    const outcome = await catchUp(entry.frame, result.catchUpRuns, seconds);
    result.catchUpRuns++;
    pacing.ran({
      index,
      seconds,
      elapsedMs: deps.now() - startedAt,
      idlePaced: shouldPaceFrame(run.idlePace, run.sweeping),
    });
    const verdict = catchUpVerdict(outcome.winner);
    if (verdict === "ask") {
      result.recoveredAsk++;
    }
    if (verdict !== "add" || !outcome.winner) {
      return;
    }
    loop.noteCatchUpAdd(outcome.winner.artKey, seconds * 1000);
    locks.push({
      seconds,
      key: outcome.winner.key,
      artKey: outcome.winner.artKey,
      label: deps.labelOf(outcome.winner.key),
      framesToLock: 0,
      score: outcome.winner.score,
      rivalScore: outcome.winner.rivalScore,
      printingResolved: false,
      multiPrinting: deps.multiPrinting(outcome.winner.artKey),
      arrivedAt: catchUpArrivals.get(entry.id) ?? null,
      source: "second-look",
    });
  }

  function noteLock(outcome: FrameOutcome, decision: FrameDecision, seconds: number): void {
    if (decision.suppressed) {
      result.suppressedRelocks++;
    }
    const track = decision.lock;
    if (!track) {
      return;
    }
    const previous = locks.at(-1);
    const lock: BenchLock = {
      seconds,
      key: track.key,
      artKey: track.artKey,
      label: track.label,
      framesToLock: track.framesToLock ?? 0,
      score: outcome.winner?.score ?? 0,
      rivalScore: outcome.winner?.rivalScore ?? 0,
      printingResolved: track.printingResolved,
      multiPrinting: deps.multiPrinting(track.artKey),
      arrivedAt:
        lastArrivalAt !== null && (previous === undefined || lastArrivalAt > previous.seconds)
          ? lastArrivalAt
          : null,
      source: "live",
    };
    locks.push(lock);
    lastLockByArt.set(lockIdOf(track), lock);
  }

  function notePrinting(outcome: FrameOutcome): void {
    const update = outcome.printingTrack;
    const lock = update?.resolved ? lastLockByArt.get(lockIdOf(update)) : undefined;
    if (!update || !lock || lock.printingResolved) {
      return;
    }
    lock.key = update.key;
    lock.label = update.label;
    lock.printingResolved = true;
    if (outcome.printingVia) {
      lock.printingVia = outcome.printingVia;
    }
    if (outcome.printingMargin !== undefined) {
      lock.printingMargin = outcome.printingMargin;
    }
    if (outcome.candidate) {
      lock.printingCardHeight = cardHeight(outcome.candidate.quad);
    }
  }

  async function noteSurvey(
    outcome: FrameOutcome,
    frame: RgbaImage,
    index: number,
    seconds: number,
  ): Promise<BoardReadResult | null> {
    if (!behaviour.boardReads || !loop.boardReadDue(outcome, frame, seconds * 1000)) {
      return null;
    }
    result.boardReads.push(seconds);
    if (!deps.readBoard) {
      return null;
    }
    const still = await (deps.loadStill ?? deps.loadFrame)(index);
    const board = await loop.readBoard(still, () => seconds * 1000);
    for (const card of board?.fresh ?? []) {
      locks.push({
        seconds,
        key: card.key,
        artKey: card.artKey,
        label: deps.labelOf(card.key),
        framesToLock: 0,
        score: Math.round(card.score * 100),
        rivalScore: Math.round(card.rivalScore * 100),
        printingResolved: false,
        multiPrinting: deps.multiPrinting(card.artKey),
        arrivedAt: null,
        source: "board",
      });
    }
    return board;
  }

  for (let index = 0; index < deps.frameCount; index++) {
    const seconds = index / deps.fps;
    const frame = await deps.loadFrame(index);
    const signal = deps.watch(frame);
    if (signal.disturbed && !wasDisturbed) {
      lastArrivalAt = seconds;
    }
    wasDisturbed = signal.disturbed;
    watchPlacement(frame, signal, seconds);

    if (!pacing.ready(index, seconds)) {
      result.skipped++;
      continue;
    }
    const catchUpDue =
      catchUp !== undefined &&
      shouldRunCatchUp({
        queued: catchUpQueue.size(),
        settling: signal.disturbed,
        cardInGuide: run.cardInGuide,
        busy: false,
      });
    if (catchUpDue) {
      result.skipped++;
      await runCatchUp(index, seconds);
      continue;
    }
    if (behaviour.skipDisturbed && loop.frameBlocked(seconds * 1000)) {
      result.skipped++;
      continue;
    }

    const startedAt = deps.now();
    const outcome = await deps.process(frame, result.processed, seconds);
    const elapsedMs = deps.now() - startedAt;
    result.processed++;
    const decision = loop.noteOutcome(outcome, seconds * 1000);
    result.sweepFrames += outcome.sweeping ? 1 : 0;
    result.stillFrames += outcome.still ? 1 : 0;
    result.frameMs.push(elapsedMs);
    stageTotals.detect += outcome.timings.detect;
    stageTotals.embed += outcome.timings.embed;
    stageTotals.verify += outcome.timings.verify;
    stageTotals.printing += outcome.timings.printing ?? 0;

    noteLock(outcome, decision, seconds);
    notePrinting(outcome);
    const board = await noteSurvey(outcome, frame, index, seconds);
    pacing.ran({
      index,
      seconds,
      elapsedMs: deps.now() - startedAt,
      idlePaced: shouldPaceFrame(run.idlePace, run.sweeping),
    });
    deps.onFrame?.({ index, seconds, frame, outcome, decision, board });
  }

  const divisor = Math.max(1, result.processed);
  return {
    ...result,
    stageMs: {
      detect: stageTotals.detect / divisor,
      embed: stageTotals.embed / divisor,
      verify: stageTotals.verify / divisor,
      printing: stageTotals.printing / divisor,
    },
    sweepShare: result.sweepFrames / divisor,
  };
}

export function frameWindows(frameCount: number, windows: number, length: number): number[][] {
  if (frameCount <= windows * length) {
    return [Array.from({ length: frameCount }, (_frame, index) => index)];
  }
  return Array.from({ length: windows }, (_run, run) => {
    const start = Math.floor(((run + 1) * frameCount) / (windows + 1) - length / 2);
    return Array.from({ length }, (_frame, offset) => start + offset);
  });
}

export interface SpeedSample {
  sweep: boolean;
  timings: FrameOutcome["timings"];
}

export interface SpeedSummary {
  frames: number;
  frame: TimingSummary;
  stageMs: { detect: number; crop: number; embed: number; verify: number; printing: number };
}

export function summarizeSpeed(samples: readonly SpeedSample[]): {
  aimed: SpeedSummary | null;
  sweep: SpeedSummary | null;
} {
  const summaryOf = (group: readonly SpeedSample[]): SpeedSummary | null => {
    if (group.length === 0) {
      return null;
    }
    const mean = (pick: (sample: SpeedSample) => number) =>
      group.reduce((sum, sample) => sum + pick(sample), 0) / group.length;
    return {
      frames: group.length,
      frame: summarize(group.map((sample) => sample.timings.total)),
      stageMs: {
        detect: mean((sample) => sample.timings.detect),
        crop: mean((sample) => sample.timings.crop),
        embed: mean((sample) => sample.timings.embed),
        verify: mean((sample) => sample.timings.verify),
        printing: mean((sample) => sample.timings.printing ?? 0),
      },
    };
  };
  return {
    aimed: summaryOf(samples.filter((sample) => !sample.sweep)),
    sweep: summaryOf(samples.filter((sample) => sample.sweep)),
  };
}
