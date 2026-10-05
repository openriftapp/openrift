/** Guards that keep a session lock from becoming a second add. */

import type { RelockGuard } from "@/features/scan/lib/scan-relock";

const RECENT_ADD_WINDOW_MS = 20_000;

export interface RecentAdds {
  note: (artKey: string, now: number) => void;
  seen: (artKey: string, now: number) => boolean;
  clear: () => void;
}

export function createRecentAdds(windowMs = RECENT_ADD_WINDOW_MS): RecentAdds {
  const added = new Map<string, number>();
  return {
    note(artKey, now) {
      added.set(artKey, now);
    },
    seen(artKey, now) {
      const at = added.get(artKey);
      return at !== undefined && now - at <= windowMs;
    },
    clear() {
      added.clear();
    },
  };
}

export interface LockCheck {
  artKey: string;
  singleMode: boolean;
  sweeping: boolean;
  placedSinceLock: boolean;
  relock: RelockGuard;
  recentBoardAdds: RecentAdds;
  now: number;
}

/** Why a session lock must not become an add, or null when it may. */
export function suppressedLock(check: LockCheck): "relock" | "board" | null {
  if (
    check.singleMode &&
    !check.sweeping &&
    !check.placedSinceLock &&
    !check.relock.allows(check.artKey)
  ) {
    return "relock";
  }
  if ((check.singleMode || check.sweeping) && check.recentBoardAdds.seen(check.artKey, check.now)) {
    return "board";
  }
  return null;
}
