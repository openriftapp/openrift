import type { OverlayBoard, OverlayBoardDirection } from "@openrift/shared/contracts/overlay";
import type { TierRow } from "@openrift/shared/types/api/tier-list";
import type { RefObject } from "react";
import { useEffect, useRef } from "react";

import {
  useClearOverlay,
  usePushOverlayBoard,
  useSetOverlayBoardReveal,
} from "@/features/stage/hooks/use-overlay";
import type { OverlayBoardSync } from "@/features/stage/lib/overlay-board-sync";
import { createOverlayBoardSync } from "@/features/stage/lib/overlay-board-sync";

interface SyncCalls {
  pushAsync: (input: { board: OverlayBoard }) => Promise<unknown>;
  revealAsync: (input: { revealCount: number }) => Promise<unknown>;
  clearAsync: () => Promise<unknown>;
}

function ensureSync(
  syncRef: RefObject<OverlayBoardSync | null>,
  calls: RefObject<SyncCalls>,
): OverlayBoardSync {
  // React Compiler cannot lower `??=` and would ship this file unoptimized.
  if (syncRef.current === null) {
    syncRef.current = createOverlayBoardSync({
      pushBoard: (board) => calls.current.pushAsync({ board }),
      setReveal: (count) => calls.current.revealAsync({ revealCount: count }),
      clear: () => calls.current.clearAsync(),
    });
  }
  return syncRef.current;
}

/**
 * Mirrors the stage board onto the signed-in creator's OBS overlay. Switching
 * the sync off clears the overlay; leaving the stage does not.
 */
export function useOverlayBoardSync({
  enabled,
  paused,
  title,
  tiers,
  direction,
  revealCount,
}: {
  enabled: boolean;
  paused: boolean;
  title: string;
  tiers: readonly TierRow[];
  direction: OverlayBoardDirection;
  revealCount: number;
}) {
  const pushBoard = usePushOverlayBoard();
  const setReveal = useSetOverlayBoardReveal();
  const clearOverlay = useClearOverlay();

  const pushAsync = pushBoard.mutateAsync;
  const revealAsync = setReveal.mutateAsync;
  const clearAsync = clearOverlay.mutateAsync;

  // Built lazily in the effects, not a useState initializer: a render-scope
  // ref read trips the React Compiler's bailout and ships the file unoptimized.
  const calls = useRef<SyncCalls>({ pushAsync, revealAsync, clearAsync });
  useEffect(() => {
    calls.current = { pushAsync, revealAsync, clearAsync };
  }, [pushAsync, revealAsync, clearAsync]);

  const syncRef = useRef<OverlayBoardSync | null>(null);
  const wasEnabled = useRef(false);

  const active = enabled && !paused;

  useEffect(() => {
    if (!active) {
      // Coming back is always a fresh push.
      syncRef.current?.forget();
      return;
    }
    ensureSync(syncRef, calls).send({ board: { title, tiers, direction }, revealCount });
  }, [active, direction, revealCount, tiers, title]);

  useEffect(() => {
    if (enabled) {
      wasEnabled.current = true;
      return;
    }
    if (!wasEnabled.current) {
      return;
    }
    wasEnabled.current = false;
    ensureSync(syncRef, calls).clear();
  }, [enabled]);
}
