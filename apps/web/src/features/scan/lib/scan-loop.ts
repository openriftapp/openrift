import type { ArtTrack } from "@openrift/shared/scan/accept";
/**
 * What the app does with each camera frame around the scan session. The
 * scanner hooks and the clip bench both drive this, so a replayed clip takes
 * the decisions a phone takes.
 */
import type { BoardCard } from "@openrift/shared/scan/board";
import { cardsInGuide } from "@openrift/shared/scan/cards-in-guide";
import type { PlacementSignal } from "@openrift/shared/scan/placement";
import { createPlacementHold } from "@openrift/shared/scan/placement";
import type { FrameOutcome } from "@openrift/shared/scan/session";
import { centeredGuideQuad } from "@openrift/shared/scan/session-options";
import type { RgbaImage } from "@openrift/shared/scan/types";

import {
  boardSurveyCounts,
  boardTriggerStart,
  freshBoardCards,
  noteBoardSurvey,
} from "@/features/scan/lib/scan-board-trigger";
import type { PendingFrame } from "@/features/scan/lib/scan-catchup";
import { nextIdlePace, settleBlocksFrame } from "@/features/scan/lib/scan-pacing";
import { suppressedLock } from "@/features/scan/lib/scan-recent-adds";
import type { ScanRun } from "@/features/scan/lib/scan-run";

export interface ScanLoopDeps {
  run: () => ScanRun;
  idleGate: () => number;
  readBoard: (still: RgbaImage) => Promise<BoardCard[] | null>;
  relockGuard?: boolean;
}

export interface FrameDecision {
  cardInGuide: boolean;
  lock: ArtTrack | null;
  suppressed: "relock" | "board" | null;
}

export interface BoardReadResult {
  read: BoardCard[];
  fresh: BoardCard[];
}

interface PlacementDecision<T> {
  /** A placement went unnamed; `missedFrame` is its settle frame when one was kept. */
  missed: boolean;
  missedFrame: T | null;
  confirmed: boolean;
}

export interface ScanLoop<T extends PendingFrame> {
  frameBlocked: (now: number) => boolean;
  noteOutcome: (outcome: FrameOutcome, now: number) => FrameDecision;
  boardReadDue: (
    outcome: FrameOutcome,
    frame: { width: number; height: number },
    now: number,
  ) => boolean;
  readBoard: (still: RgbaImage, now: () => number) => Promise<BoardReadResult | null>;
  observePlacement: (
    signal: PlacementSignal,
    now: number,
    takeFrame: () => T | null,
  ) => PlacementDecision<T>;
  noteCatchUpAdd: (artKey: string, now: number) => void;
  reset: () => void;
}

export function createScanLoop<T extends PendingFrame>(deps: ScanLoopDeps): ScanLoop<T> {
  let trigger = boardTriggerStart();
  let hold = createPlacementHold();
  let settle: { at: number; pending: T | null } | null = null;

  function frameBlocked(now: number): boolean {
    const run = deps.run();
    return !run.sweeping && settleBlocksFrame(run.settling, now, run.capturing);
  }

  function noteOutcome(outcome: FrameOutcome, now: number): FrameDecision {
    const run = deps.run();
    const top = outcome.ranked[0];
    const cardInGuide =
      outcome.winner !== null || (top !== undefined && top.distance <= deps.idleGate());
    run.update({ sweeping: outcome.sweeping, still: outcome.still, cardInGuide });
    // Before the lock, so the guide emptying and this frame's lock are judged
    // in the order they happened.
    run.relock.observe(cardInGuide, now);
    run.update({ idlePace: nextIdlePace(run.idlePace, cardInGuide, outcome.timings.total) });
    const track = outcome.locked;
    if (!track) {
      return { cardInGuide, lock: null, suppressed: null };
    }
    const suppressed = suppressedLock({
      artKey: track.artKey,
      singleMode: run.mode === "single" && deps.relockGuard !== false,
      sweeping: outcome.sweeping,
      placedSinceLock: run.pile.placedSinceLock(),
      relock: run.relock,
      recentBoardAdds: run.recentBoardAdds,
      now,
    });
    if (suppressed) {
      return { cardInGuide, lock: null, suppressed };
    }
    run.relock.note(track.artKey, now);
    run.pile.noteLock(now);
    run.tally.noteNamed();
    run.update({ pendingFrame: null });
    return { cardInGuide, lock: track, suppressed: null };
  }

  function boardReadDue(
    outcome: FrameOutcome,
    frame: { width: number; height: number },
    now: number,
  ): boolean {
    const run = deps.run();
    const counts = boardSurveyCounts({
      cardInGuide: run.cardInGuide,
      settling: run.settling.disturbed,
      sweeping: outcome.sweeping,
    });
    if (!outcome.survey || !counts) {
      return false;
    }
    const cards = cardsInGuide(outcome.survey, centeredGuideQuad(frame.width, frame.height), frame);
    return noteBoardSurvey(trigger, cards.length, now);
  }

  async function readBoard(still: RgbaImage, now: () => number): Promise<BoardReadResult | null> {
    const read = await deps.readBoard(still);
    if (read === null) {
      return null;
    }
    const run = deps.run();
    const fresh = freshBoardCards(trigger, read).filter((card) => run.relock.allows(card.artKey));
    const addedAt = now();
    for (const card of fresh) {
      run.recentBoardAdds.note(card.artKey, addedAt);
      run.relock.note(card.artKey, addedAt);
    }
    return { read, fresh };
  }

  function observePlacement(
    signal: PlacementSignal,
    now: number,
    takeFrame: () => T | null,
  ): PlacementDecision<T> {
    const run = deps.run();
    // Must update now, not when the next card arrives, or the session's
    // last card goes uncounted.
    run.update({ settling: { disturbed: signal.disturbed, at: now } });
    if ((run.mode === "single" && !run.still) || run.sweeping) {
      hold = createPlacementHold();
      settle = null;
      return { missed: false, missedFrame: null, confirmed: false };
    }
    const missed = run.tally.takeMiss(now);
    let missedFrame: T | null = null;
    if (missed) {
      missedFrame = run.pendingFrame as T | null;
      run.update({ pendingFrame: null });
    }
    if (signal.placed) {
      settle = { at: now, pending: takeFrame() };
    }
    const current = settle;
    const confirmed = run.mode === "capture" ? signal.placed : hold.observe(signal, now / 1000);
    // A lock during the hold already answered this placement.
    if (!confirmed || !current || run.pile.lockedSince(current.at)) {
      return { missed, missedFrame, confirmed: false };
    }
    settle = null;
    run.tally.notePlacement(now);
    run.pile.notePlacement();
    run.update({ pendingFrame: current.pending });
    return { missed, missedFrame, confirmed: true };
  }

  function noteCatchUpAdd(artKey: string, now: number): void {
    const run = deps.run();
    // Must decrement by one, not reset: other cards from the same burst
    // may still be genuinely unaccounted for.
    run.tally.noteRecovered();
    run.relock.note(artKey, now);
  }

  function reset(): void {
    trigger = boardTriggerStart();
    hold = createPlacementHold();
    settle = null;
  }

  return {
    frameBlocked,
    noteOutcome,
    boardReadDue,
    readBoard,
    observePlacement,
    noteCatchUpAdd,
    reset,
  };
}
