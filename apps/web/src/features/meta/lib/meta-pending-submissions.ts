import type { MetaEventPlayer, MetaPendingSubmission } from "@openrift/shared/types/api/meta";

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

/** A row id that no longer appears in the standings counts as unmatched. */
export function groupPendingSubmissions(
  items: readonly MetaPendingSubmission[],
  players: readonly Pick<MetaEventPlayer, "id">[],
): MetaPendingSubmissions {
  const playerIds = new Set(players.map((player) => player.id));
  const byPlayer = new Map<string, MetaPendingRowMark>();
  const unmatched: MetaPendingSubmission[] = [];
  for (const item of items) {
    if (item.metaEventPlayerId === null || !playerIds.has(item.metaEventPlayerId)) {
      unmatched.push(item);
      continue;
    }
    const mine = item.mine || (byPlayer.get(item.metaEventPlayerId)?.mine ?? false);
    byPlayer.set(item.metaEventPlayerId, { mine });
  }
  return { byPlayer, unmatched };
}
