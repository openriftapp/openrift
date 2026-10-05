import type { AimStreaks } from "@/features/scan/lib/scan-aim-streak";
import { createAimStreaks } from "@/features/scan/lib/scan-aim-streak";
import type { PendingFrame } from "@/features/scan/lib/scan-catchup";
import type { IdlePace } from "@/features/scan/lib/scan-pacing";
import { idlePaceStart } from "@/features/scan/lib/scan-pacing";
import type { PileState } from "@/features/scan/lib/scan-pile";
import { createPileState } from "@/features/scan/lib/scan-pile";
import type { PlacementTally } from "@/features/scan/lib/scan-placement-counts";
import { createPlacementTally } from "@/features/scan/lib/scan-placement-counts";
import type { RecentAdds } from "@/features/scan/lib/scan-recent-adds";
import { createRecentAdds } from "@/features/scan/lib/scan-recent-adds";
import type { RelockGuard } from "@/features/scan/lib/scan-relock";
import { createRelockGuard } from "@/features/scan/lib/scan-relock";
import type { RotationTracker } from "@/features/scan/lib/scan-rotation";
import { createRotationTracker } from "@/features/scan/lib/scan-rotation";
import type { ScannerMode } from "@/features/scan/lib/scan-session";

export interface ScanRun {
  mode: ScannerMode;
  relock: RelockGuard;
  recentBoardAdds: RecentAdds;
  pile: PileState;
  tally: PlacementTally;
  rotation: RotationTracker;
  aimStreaks: AimStreaks;
  /** `at` in performance.now() milliseconds. */
  settling: { disturbed: boolean; at: number };
  pendingFrame: PendingFrame | null;
  sweeping: boolean;
  still: boolean;
  capturing: boolean;
  switching: boolean;
  cardInGuide: boolean;
  idlePace: IdlePace;
  frameIndex: number;
  /** performance.now() milliseconds. */
  startedAt: number;
  update: (patch: Partial<ScanRunFields>) => void;
  reset: (now: number) => void;
  resetSession: (now: number) => void;
}

type ScanRunFields = Omit<ScanRun, "update" | "reset" | "resetSession">;

export function createScanRun(mode: ScannerMode): ScanRun {
  const run: ScanRun = {
    mode,
    relock: createRelockGuard(),
    recentBoardAdds: createRecentAdds(),
    pile: createPileState(),
    tally: createPlacementTally(),
    rotation: createRotationTracker(),
    aimStreaks: createAimStreaks(),
    settling: { disturbed: false, at: 0 },
    pendingFrame: null,
    sweeping: false,
    still: false,
    capturing: false,
    switching: false,
    cardInGuide: false,
    idlePace: idlePaceStart(),
    frameIndex: 0,
    startedAt: 0,
    update(patch) {
      Object.assign(run, patch);
    },
    resetSession(now) {
      run.settling = { disturbed: false, at: 0 };
      run.pendingFrame = null;
      run.sweeping = false;
      run.still = false;
      run.capturing = false;
      run.switching = false;
      run.cardInGuide = false;
      run.idlePace = idlePaceStart();
      run.aimStreaks.clear();
      run.frameIndex = 0;
      run.startedAt = now;
    },
    reset(now) {
      run.resetSession(now);
      run.relock.reset();
      run.recentBoardAdds.clear();
      run.pile.reset();
      run.tally = createPlacementTally();
      run.rotation.reset();
    },
  };
  return run;
}
