/**
 * Locks and confirmed pile placements, shared by the placement watcher and
 * the frame loop: a second copy of an artwork may be added only after a
 * placement, and a placement a lock already answered must not re-arm.
 */

export interface PileState {
  noteLock: (now: number) => void;
  notePlacement: () => void;
  /** Whether a lock landed at or after `since`, in performance.now() milliseconds. */
  lockedSince: (since: number) => boolean;
  placedSinceLock: () => boolean;
  reset: () => void;
}

export function createPileState(): PileState {
  let lastLockAt = Number.NEGATIVE_INFINITY;
  let placed = false;
  return {
    noteLock(now) {
      lastLockAt = now;
      placed = false;
    },
    notePlacement() {
      placed = true;
    },
    lockedSince(since) {
      return lastLockAt >= since;
    },
    placedSinceLock() {
      return placed;
    },
    reset() {
      lastLockAt = Number.NEGATIVE_INFINITY;
      placed = false;
    },
  };
}
