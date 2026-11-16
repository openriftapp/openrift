import type { OverlayBoard } from "@openrift/shared/contracts/overlay";
import type { TierRow } from "@openrift/shared/types/api/tier-list";

import { runReportedMutation } from "@/lib/run-reported-mutation";

export interface OverlayBoardFrame extends Omit<OverlayBoard, "revealCount" | "tiers"> {
  tiers: readonly TierRow[];
}

interface OverlayBoardIntent {
  board: OverlayBoardFrame;
  revealCount: number;
}

export interface OverlayBoardSyncDeps {
  pushBoard: (board: OverlayBoard) => Promise<unknown>;
  setReveal: (revealCount: number) => Promise<unknown>;
  clear: () => Promise<unknown>;
}

export interface OverlayBoardSync {
  send: (intent: OverlayBoardIntent) => void;
  /** The next send pushes the whole board, even if it is the one already up. */
  forget: () => void;
  /** Drops what is waiting and takes the board down once the call in flight has landed. */
  clear: () => void;
}

function sameBoard(a: OverlayBoardFrame, b: OverlayBoardFrame): boolean {
  return a.title === b.title && a.tiers === b.tiers && a.direction === b.direction;
}

/**
 * Sends one call at a time, and only the latest intent. A board already on the overlay is
 * stepped by its reveal count alone; a board counts as up only once its push succeeded.
 */
export function createOverlayBoardSync(deps: OverlayBoardSyncDeps): OverlayBoardSync {
  let inFlight = false;
  let next: OverlayBoardIntent | null = null;
  let clearPending = false;
  let shown: OverlayBoardFrame | null = null;
  let generation = 0;

  const step = async (intent: OverlayBoardIntent) => {
    if (shown !== null && sameBoard(shown, intent.board)) {
      await runReportedMutation(() => deps.setReveal(intent.revealCount));
      return;
    }
    const startedIn = generation;
    const ok = await runReportedMutation(() =>
      deps.pushBoard({
        ...intent.board,
        tiers: [...intent.board.tiers],
        revealCount: intent.revealCount,
      }),
    );
    if (ok && startedIn === generation) {
      shown = intent.board;
    }
  };

  const drain = async () => {
    inFlight = true;
    while (clearPending || next !== null) {
      if (clearPending) {
        clearPending = false;
        await runReportedMutation(deps.clear);
      } else if (next !== null) {
        const intent = next;
        next = null;
        await step(intent);
      }
    }
    inFlight = false;
  };

  const forget = () => {
    shown = null;
    generation += 1;
  };

  return {
    send(intent) {
      next = intent;
      if (!inFlight) {
        void drain();
      }
    },
    forget,
    clear() {
      next = null;
      clearPending = true;
      forget();
      if (!inFlight) {
        void drain();
      }
    },
  };
}
