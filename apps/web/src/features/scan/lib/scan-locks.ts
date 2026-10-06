import type { ArtTrack, FrameWinner } from "@openrift/shared/scan/accept";
import { lockIdOf } from "@openrift/shared/scan/accept";
import type { BoardCard } from "@openrift/shared/scan/board";
import type { CardLabels } from "@openrift/shared/scan/labels";
import type { FrameOutcome } from "@openrift/shared/scan/session";

import { describeKey } from "@/features/scan/lib/scan-bank";
import type { FrameLogEntry } from "@/features/scan/lib/scan-frame-log";

export const LOCK_HISTORY_LIMIT = 30;

export interface LockedCard {
  key: string;
  artKey: string;
  label: string;
  resolved: boolean;
  at: number;
  lockSeconds: number;
  framesToLock: number;
  /** Percent. */
  score: number;
  lockedFrame?: number;
  alternatives?: string[];
}

export interface PrintingUpdate {
  artKey: string;
  key: string;
  label: string;
  resolved: boolean;
  lockedFrame?: number;
}

export interface BoardReadCard {
  key: string;
  artKey: string;
  label: string;
  resolved: boolean;
  /** Empty when the read was confident. */
  alternatives: string[];
}

export interface ScannerEvents {
  onLock?: (lock: LockedCard) => void;
  onLockResolved?: (update: { artKey: string; key: string; label: string }) => void;
  onBoardRead?: (cards: BoardReadCard[]) => void;
  onFrame?: (frame: FrameLogEntry) => void;
}

export function boardReadCards(
  cards: readonly BoardCard[],
  labelOf: (key: string) => string,
): BoardReadCard[] {
  return cards.map((card) => ({
    key: card.key,
    artKey: card.artKey,
    label: labelOf(card.key),
    resolved: card.printingResolved,
    alternatives: card.confident ? [] : card.alternatives,
  }));
}

/** A second look's add: one frame, timed by its own processing. */
export function lockFromWinner(
  winner: FrameWinner,
  outcome: Pick<FrameOutcome, "timings">,
  labels: CardLabels,
  at: number,
): LockedCard {
  return {
    key: winner.key,
    artKey: winner.artKey,
    label: describeKey(labels, winner.key),
    resolved: false,
    at,
    lockSeconds: outcome.timings.total / 1000,
    framesToLock: 1,
    score: winner.score,
  };
}

export interface LockFromTrackInput {
  track: ArtTrack;
  tapped: boolean;
  totalMs: number;
  score: number;
  at: number;
}

export function lockFromTrack(input: LockFromTrackInput): LockedCard {
  const { track, tapped } = input;
  const lockSeconds = tapped
    ? input.totalMs / 1000
    : (track.lockedAt ?? track.runStartSeconds) - track.runStartSeconds;
  return {
    key: track.key,
    artKey: track.artKey,
    label: track.label,
    resolved: track.printingResolved,
    at: input.at,
    lockSeconds,
    framesToLock: tapped ? 1 : (track.framesToLock ?? 0),
    score: input.score,
    ...(track.lockedFrame === undefined ? {} : { lockedFrame: track.lockedFrame }),
  };
}

export function appendLock(locks: readonly LockedCard[], lock: LockedCard): LockedCard[] {
  return [lock, ...locks].slice(0, LOCK_HISTORY_LIMIT);
}

export function resolvePrintingIn(
  locks: readonly LockedCard[],
  update: PrintingUpdate,
): LockedCard[] | null {
  const id = lockIdOf(update);
  const index = locks.findIndex((lock) => lockIdOf(lock) === id);
  const existing = locks[index];
  if (!existing || existing.key === update.key) {
    return null;
  }
  const refreshed = [...locks];
  refreshed[index] = {
    ...existing,
    key: update.key,
    label: update.label,
    resolved: true,
  };
  return refreshed;
}
