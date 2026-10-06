import type { FrameOutcome } from "@openrift/shared/scan/session";
import type { RgbaImage } from "@openrift/shared/scan/types";
import type { RefObject } from "react";
import { useRef, useState } from "react";

import type { ScanBankInfo } from "@/features/scan/lib/scan-bank";
import type {
  CatchUpVerdict,
  IdentifyAttempt,
  PendingFrame,
  UnidentifiedCard,
} from "@/features/scan/lib/scan-catchup";
import {
  CATCH_UP_SHORTLIST,
  catchUpVerdict,
  createCatchUpQueue,
  rankedArtworks,
  shouldRunCatchUp,
} from "@/features/scan/lib/scan-catchup";
import { LOCK_VIBRATION_MS } from "@/features/scan/lib/scan-feedback";
import { guideRectIn, snapshotVideoRect } from "@/features/scan/lib/scan-flight";
import type { ScannerEvents } from "@/features/scan/lib/scan-locks";
import { lockFromWinner } from "@/features/scan/lib/scan-locks";
import type { ScanLoop } from "@/features/scan/lib/scan-loop";
import type { ScanRun } from "@/features/scan/lib/scan-run";
import type { SessionKind } from "@/features/scan/lib/scan-worker-protocol";
import { errorText } from "@/lib/error-text";

export interface ScanCatchUpOptions {
  bank: ScanBankInfo | null;
  loop: () => ScanLoop<PendingFrame>;
  videoRef: RefObject<HTMLVideoElement | null>;
  runningRef: RefObject<boolean>;
  runGenerationRef: RefObject<number>;
  runRef: RefObject<ScanRun>;
  eventsRef: RefObject<ScannerEvents | undefined>;
  grabFrame: (video: HTMLVideoElement) => RgbaImage | null;
  processFrame: (
    kind: SessionKind,
    frame: RgbaImage,
    index: number,
    seconds: number,
  ) => Promise<FrameOutcome | null>;
}

export interface ScanCatchUp {
  pending: UnidentifiedCard[];
  dismiss: (id: string) => void;
  enqueue: (frame: PendingFrame, at: number) => void;
  shouldRun: (settling: boolean, cardInGuide: boolean) => boolean;
  run: () => Promise<void>;
  identifyNow: (onSnapshot?: (snapshot: string | null) => void) => Promise<IdentifyAttempt>;
  clearQueue: () => void;
  reset: () => void;
}

interface SecondLook {
  outcome: FrameOutcome;
  verdict: CatchUpVerdict;
}

export function useScanCatchUp(options: ScanCatchUpOptions): ScanCatchUp {
  const { bank, videoRef, runningRef, runGenerationRef, runRef, eventsRef } = options;
  const queueRef = useRef(createCatchUpQueue());
  const queuedBusyRef = useRef(false);
  const identifyBusyRef = useRef(false);
  const queuedLookRef = useRef<Promise<SecondLook | null> | null>(null);
  const identifyRef = useRef<Promise<IdentifyAttempt> | null>(null);
  const seqRef = useRef(0);
  const [pending, setPending] = useState<UnidentifiedCard[]>([]);

  function shortlist(ranked: FrameOutcome["ranked"]) {
    return rankedArtworks(ranked, bank?.artKeys ?? new Map()).slice(0, CATCH_UP_SHORTLIST);
  }

  async function processSecondLook(frame: RgbaImage, tag: string): Promise<SecondLook | null> {
    const generation = runGenerationRef.current;
    const seconds = (performance.now() - runRef.current.startedAt) / 1000;
    let outcome: FrameOutcome | null = null;
    try {
      outcome = await options.processFrame("catchUp", frame, seqRef.current, seconds);
    } catch (lookError) {
      console.log(`[scan] ${tag} failed: ${errorText(lookError, "unknown")}`);
    }
    if (!outcome || generation !== runGenerationRef.current) {
      return null;
    }
    const verdict = catchUpVerdict(outcome.winner);
    const winner = outcome.winner;
    const detail = winner
      ? ` ${winner.key} score ${winner.score} vs rival ${winner.rivalScore}`
      : " nothing verified";
    console.log(`[scan] ${tag}: ${verdict}${detail}`);
    return { outcome, verdict };
  }

  function emitLock(outcome: FrameOutcome): void {
    const winner = outcome.winner;
    if (winner) {
      eventsRef.current?.onLock?.(lockFromWinner(winner, outcome, bank?.labels ?? {}, Date.now()));
    }
  }

  function enqueue(frame: PendingFrame, at: number): void {
    seqRef.current += 1;
    queueRef.current.push({
      id: `catchup-${seqRef.current}`,
      frame: frame.frame,
      thumbnail: frame.thumbnail,
      at,
    });
  }

  function shouldRun(settling: boolean, cardInGuide: boolean): boolean {
    return shouldRunCatchUp({
      queued: queueRef.current.size(),
      settling,
      cardInGuide,
      busy: queuedBusyRef.current || identifyBusyRef.current,
    });
  }

  async function run(): Promise<void> {
    const entry = queueRef.current.take();
    if (!entry) {
      return;
    }
    queuedBusyRef.current = true;
    const queuedLook = processSecondLook(entry.frame, `catch-up ${entry.id}`);
    queuedLookRef.current = queuedLook;
    const look = await queuedLook;
    queuedBusyRef.current = false;
    if (queuedLookRef.current === queuedLook) {
      queuedLookRef.current = null;
    }
    if (!look || look.verdict === "discard") {
      return;
    }
    if (look.verdict === "add" && look.outcome.winner) {
      options.loop().noteCatchUpAdd(look.outcome.winner.artKey, performance.now());
      emitLock(look.outcome);
      return;
    }
    const candidates = shortlist(look.outcome.ranked);
    setPending((current) => [
      ...current,
      { id: entry.id, thumbnail: entry.thumbnail, candidates, at: entry.at },
    ]);
  }

  /**
   * Must grab a fresh frame: the published readout can lag behind a stale
   * card while the guide idles or settles.
   */
  async function identifyOnce(
    onSnapshot?: (snapshot: string | null) => void,
  ): Promise<IdentifyAttempt> {
    const video = videoRef.current;
    if (!video || !runningRef.current) {
      return { snapshot: null, identified: false, candidates: [] };
    }
    const snapshot = snapshotVideoRect(video, guideRectIn(video.getBoundingClientRect()));
    onSnapshot?.(snapshot);
    const frame = options.grabFrame(video);
    if (!frame) {
      return { snapshot, identified: false, candidates: [] };
    }
    identifyBusyRef.current = true;
    await queuedLookRef.current;
    seqRef.current += 1;
    const look = await processSecondLook(frame, "identify-now");
    identifyBusyRef.current = false;
    if (!look) {
      return { snapshot, identified: false, candidates: [] };
    }
    if (look.verdict === "add" && look.outcome.winner) {
      navigator.vibrate?.(LOCK_VIBRATION_MS);
      runRef.current.relock.note(look.outcome.winner.artKey, performance.now());
      emitLock(look.outcome);
      return { snapshot, identified: true, candidates: [] };
    }
    return { snapshot, identified: false, candidates: shortlist(look.outcome.ranked) };
  }

  async function identifyNow(
    onSnapshot?: (snapshot: string | null) => void,
  ): Promise<IdentifyAttempt> {
    const running = identifyRef.current;
    if (running) {
      return await running;
    }
    const attempt = identifyOnce(onSnapshot);
    identifyRef.current = attempt;
    let result: IdentifyAttempt | null = null;
    let failure: unknown = null;
    try {
      result = await attempt;
    } catch (identifyError) {
      failure = identifyError;
    }
    if (identifyRef.current === attempt) {
      identifyRef.current = null;
    }
    if (result === null) {
      throw failure;
    }
    return result;
  }

  function clearQueue(): void {
    queueRef.current.clear();
    queuedBusyRef.current = false;
    identifyBusyRef.current = false;
    queuedLookRef.current = null;
    identifyRef.current = null;
  }

  function reset(): void {
    clearQueue();
    setPending([]);
  }

  function dismiss(id: string): void {
    setPending((current) => current.filter((card) => card.id !== id));
  }

  return { pending, dismiss, enqueue, shouldRun, run, identifyNow, clearQueue, reset };
}
