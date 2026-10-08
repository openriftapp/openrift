import type { FrameOutcome } from "@openrift/shared/scan/session";
import { centeredGuideQuad } from "@openrift/shared/scan/session-options";
import type { RgbaImage } from "@openrift/shared/scan/types";
import type { RefObject } from "react";
import { useRef, useState } from "react";

import {
  areaFractionOfGuide,
  createAimHintSmoother,
  deriveAimHint,
} from "@/features/scan/lib/scan-aim-hint";
import type { ScanBankInfo } from "@/features/scan/lib/scan-bank";
import type { PendingFrame } from "@/features/scan/lib/scan-catchup";
import { LOCK_VIBRATION_MS } from "@/features/scan/lib/scan-feedback";
import { frameLogEntry, frameLogLine, printingLogLine } from "@/features/scan/lib/scan-frame-log";
import type { LockedCard, ScannerEvents } from "@/features/scan/lib/scan-locks";
import { appendLock, lockFromTrack, resolvePrintingIn } from "@/features/scan/lib/scan-locks";
import type { FrameDecision, ScanLoop } from "@/features/scan/lib/scan-loop";
import {
  IDLE_PACE_DELAY_MS,
  PAUSED_POLL_MS,
  createFpsWindow,
  publishDue,
  shouldPaceFrame,
} from "@/features/scan/lib/scan-pacing";
import type { ScannerReadout } from "@/features/scan/lib/scan-readout";
import { EMPTY_READOUT, aimHintInputFor, buildReadout } from "@/features/scan/lib/scan-readout";
import type { ScanRun } from "@/features/scan/lib/scan-run";
import type { ScannerSettings } from "@/features/scan/lib/scan-session";
import { lockRunForMode } from "@/features/scan/lib/scan-session";
import type { SessionKind } from "@/features/scan/lib/scan-worker-protocol";
import { errorText } from "@/lib/error-text";
import { m } from "@/paraglide/messages.js";

import type { ScanBoard } from "./use-scan-board";
import type { ScanOverlayTargetInput } from "./use-scan-overlay";

export interface ScanFramesOptions {
  bank: ScanBankInfo | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  runningRef: RefObject<boolean>;
  runGenerationRef: RefObject<number>;
  settingsRef: RefObject<ScannerSettings>;
  eventsRef: RefObject<ScannerEvents | undefined>;
  runRef: RefObject<ScanRun>;
  loop: () => ScanLoop<PendingFrame>;
  setFrameInFlight: (frame: Promise<unknown>) => void;
  grabFrame: (video: HTMLVideoElement) => RgbaImage | null;
  hasSession: () => boolean;
  processFrame: (
    kind: SessionKind,
    frame: RgbaImage,
    index: number,
    seconds: number,
  ) => Promise<FrameOutcome | null>;
  setOverlayTarget: (input: ScanOverlayTargetInput) => void;
  shouldCatchUp: (settling: boolean, cardInGuide: boolean) => boolean;
  runCatchUp: () => Promise<void>;
  noteBoardSurvey: ScanBoard["noteSurvey"];
  onError: (message: string) => void;
}

export interface ScanFrames {
  readout: ScannerReadout;
  startLoop: () => void;
  capture: () => Promise<void>;
  resetAimHint: () => void;
  clearHistory: () => void;
}

export function useScanFrames(options: ScanFramesOptions): ScanFrames {
  const { bank, videoRef, runningRef, runGenerationRef, settingsRef, eventsRef, runRef } = options;
  const locksRef = useRef<LockedCard[]>([]);
  const lastPublishRef = useRef(0);
  const fpsRef = useRef(createFpsWindow());
  const aimHintSmootherRef = useRef(createAimHintSmoother());
  const [readout, setReadout] = useState<ScannerReadout>(EMPTY_READOUT);

  function publish(
    outcome: FrameOutcome,
    aim: ScannerReadout["aim"],
    runLength: number,
    lockRun: number,
    candidateAreaFraction: number,
    force: boolean,
  ) {
    const now = performance.now();
    const fps = fpsRef.current.sample(now);
    if (!publishDue(lastPublishRef.current, now, force)) {
      return;
    }
    lastPublishRef.current = now;
    const run = runRef.current;
    const settling = run.settling.disturbed;
    const aimHint = aimHintSmootherRef.current.update(
      deriveAimHint(aimHintInputFor(outcome, candidateAreaFraction, settling)),
      now,
    );
    setReadout(
      buildReadout({
        outcome,
        aim,
        aimHint,
        fps,
        locks: locksRef.current,
        runLength,
        lockRun,
        candidateAreaFraction,
        placements: run.tally.placements(),
        missedPlacements: run.tally.missedTotal(),
        missedSinceNamed: run.tally.missedSinceNamed(),
        settling,
      }),
    );
  }

  function noteLock(outcome: FrameOutcome, decision: FrameDecision) {
    const track = decision.lock;
    if (decision.suppressed) {
      console.log(`[scan] lock of ${outcome.locked?.label} suppressed (${decision.suppressed})`);
    }
    if (!track) {
      return;
    }
    const run = runRef.current;
    const lock = lockFromTrack({
      track,
      tapped: run.mode === "capture",
      totalMs: outcome.timings.total,
      score: outcome.winner === null ? 0 : outcome.winner.score,
      at: Date.now(),
    });
    locksRef.current = appendLock(locksRef.current, lock);
    const aimSeconds = run.aimStreaks.take(track.artKey, performance.now());
    const aimPart = aimSeconds === null ? "" : `, aim-to-lock ${aimSeconds.toFixed(2)}s`;
    console.log(
      `[scan] LOCK ${track.label} (${track.key}) after ${lock.framesToLock} frames, ${lock.lockSeconds.toFixed(2)}s${aimPart}`,
    );
    navigator.vibrate?.(LOCK_VIBRATION_MS);
    eventsRef.current?.onLock?.(lock);
  }

  function notePrinting(outcome: FrameOutcome) {
    const update = outcome.printingTrack;
    if (!update) {
      return;
    }
    const printingLine = printingLogLine(outcome);
    if (printingLine !== null) {
      console.log(printingLine);
    }
    if (!update.resolved) {
      return;
    }
    const refreshed = resolvePrintingIn(locksRef.current, update);
    if (refreshed === null) {
      return;
    }
    locksRef.current = refreshed;
    eventsRef.current?.onLockResolved?.({
      artKey: update.artKey,
      key: update.key,
      label: update.label,
    });
  }

  function noteWinnerRotation(outcome: FrameOutcome): void {
    if (!outcome.winner) {
      return;
    }
    const winnerKey = outcome.winner.key;
    // A landscape reference render (battlefields) reports a rotation whatever
    // the frame's orientation; it must never drive adoption.
    if (bank?.labels[winnerKey]?.type === "battlefield") {
      return;
    }
    const rotation = outcome.ranked.find((entry) => entry.key === winnerKey)?.rotation ?? 0;
    const adopted = runRef.current.rotation.note(rotation);
    if (adopted !== null) {
      console.log(`[scan] frame rotation adopted: +${rotation} quarter turns (now ${adopted})`);
    }
  }

  async function runFrame(): Promise<void> {
    const video = videoRef.current;
    if (!video || !options.hasSession()) {
      return;
    }
    const run = runRef.current;
    if (options.loop().frameBlocked(performance.now())) {
      return;
    }
    const turns = run.rotation.turns();
    const grabbedAt = performance.now();
    const frame = options.grabFrame(video);
    if (!frame) {
      return;
    }

    const generation = runGenerationRef.current;
    const frameIndex = run.frameIndex;
    run.update({ frameIndex: frameIndex + 1 });
    const outcome = await options.processFrame(
      "live",
      frame,
      frameIndex,
      (performance.now() - run.startedAt) / 1000,
    );
    if (!outcome || generation !== runGenerationRef.current) {
      // A stop or mode switch landed while this frame was in flight; its
      // outcome must not reach the new run.
      return;
    }
    const rankedTop = outcome.ranked[0];
    const decision = options.loop().noteOutcome(outcome, performance.now());
    let aimAgeSeconds = 0;
    let aim: ScannerReadout["aim"] = null;
    if (rankedTop) {
      const topArt = bank?.artKeys.get(rankedTop.key) ?? rankedTop.key;
      aimAgeSeconds = run.aimStreaks.touch(topArt, performance.now());
      if (decision.cardInGuide) {
        aim = { artKey: topArt, key: rankedTop.key, seconds: aimAgeSeconds };
      }
    }

    noteLock(outcome, decision);
    notePrinting(outcome);
    noteWinnerRotation(outcome);

    console.log(frameLogLine(frameIndex, outcome, aimAgeSeconds));

    const lockRun = lockRunForMode(run.mode);
    const runLength = outcome.winnerRun ? Math.min(outcome.winnerRun.weight, lockRun) : 0;

    const areaFraction =
      outcome.candidate === null
        ? 0
        : areaFractionOfGuide(outcome.candidate.quad, centeredGuideQuad(frame.width, frame.height));
    options.setOverlayTarget({
      quad: outcome.winner === null ? null : (outcome.candidate?.quad ?? null),
      guide: !outcome.sweeping,
      frameWidth: frame.width,
      frameHeight: frame.height,
      turns,
      focus: outcome.focus,
      runLength,
      lockRun,
    });
    publish(outcome, aim, runLength, lockRun, areaFraction, outcome.locked !== null);
    const board = await options.noteBoardSurvey(outcome, frame);
    eventsRef.current?.onFrame?.(frameLogEntry(grabbedAt, outcome, decision, board));
  }

  function startLoop(): void {
    const generation = runGenerationRef.current;
    // Declared here, not at hook level, so the loop never references a
    // hoisted function by name; the React Compiler bails out on that.
    const loop = () => {
      if (generation !== runGenerationRef.current) {
        return;
      }
      if (settingsRef.current.paused) {
        setTimeout(() => requestAnimationFrame(loop), PAUSED_POLL_MS);
        return;
      }
      const run = runRef.current;
      const inFlight = options.shouldCatchUp(run.settling.disturbed, run.cardInGuide)
        ? options.runCatchUp()
        : runFrame();
      options.setFrameInFlight(inFlight);
      const scheduleNext = () => {
        if (shouldPaceFrame(run.idlePace, run.sweeping)) {
          setTimeout(() => requestAnimationFrame(loop), IDLE_PACE_DELAY_MS);
        } else {
          requestAnimationFrame(loop);
        }
      };
      /* oxlint-disable promise/prefer-await-to-then, promise/prefer-catch -- the rAF loop is callback-shaped; a rejected frame must not kill it */
      inFlight.then(scheduleNext, (frameError: unknown) => {
        options.onError(errorText(frameError, m.scan_frame_failed()));
        scheduleNext();
      });
      /* oxlint-enable promise/prefer-await-to-then, promise/prefer-catch */
    };
    requestAnimationFrame(loop);
  }

  async function capture(): Promise<void> {
    const run = runRef.current;
    if (!runningRef.current || run.capturing || run.switching) {
      return;
    }
    run.update({ capturing: true });
    const inFlight = runFrame();
    options.setFrameInFlight(inFlight);
    try {
      await inFlight;
    } catch (captureError) {
      options.onError(errorText(captureError, m.scan_frame_failed()));
    }
    run.update({ capturing: false });
  }

  function resetAimHint(): void {
    aimHintSmootherRef.current.reset();
  }

  function clearHistory(): void {
    locksRef.current = [];
    fpsRef.current.clear();
    runRef.current.aimStreaks.clear();
    setReadout({ ...EMPTY_READOUT });
  }

  return { readout, startLoop, capture, resetAimHint, clearHistory };
}
