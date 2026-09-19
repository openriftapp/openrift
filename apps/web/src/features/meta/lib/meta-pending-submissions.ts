import type { MetaPendingSubmission } from "@openrift/shared/types/api/meta";

export interface MetaPendingRowMark {
  mine: boolean;
}

export interface MetaPendingSubmissions {
  byPlayer: ReadonlyMap<string, MetaPendingRowMark>;
  unmatched: readonly MetaPendingSubmission[];
}

export const NO_PENDING_SUBMISSIONS: MetaPendingSubmissions = {
  byPlayer: new Map(),
  unmatched: [],
};

/**
 * `meta_submissions.meta_event_player_id` is `on delete set null`, so a
 * non-null id always names a row this event still holds.
 */
export function groupPendingSubmissions(
  items: readonly MetaPendingSubmission[],
): MetaPendingSubmissions {
  const byPlayer = new Map<string, MetaPendingRowMark>();
  const unmatched: MetaPendingSubmission[] = [];
  for (const item of items) {
    if (item.metaEventPlayerId === null) {
      unmatched.push(item);
      continue;
    }
    const mine = item.mine || (byPlayer.get(item.metaEventPlayerId)?.mine ?? false);
    byPlayer.set(item.metaEventPlayerId, { mine });
  }
  return { byPlayer, unmatched };
}
