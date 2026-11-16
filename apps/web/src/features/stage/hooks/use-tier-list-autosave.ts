import type { TierRow } from "@openrift/shared/types/api/tier-list";
import { useDebouncer } from "@tanstack/react-pacer";
import { useEffect } from "react";

import { useUpdateTierList } from "@/features/stage/hooks/use-tier-lists";
import { useTierListBuilderStore } from "@/features/stage/stores/tier-list-builder-store";

export const AUTOSAVE_WAIT_MS = 1200;

export type TierListAutosaveStatus = "saving" | "saved" | "failed";

export interface TierListAutosave {
  status: TierListAutosaveStatus;
  flush: () => void;
  retry: () => void;
}

interface QueuedSave {
  id: string;
  rows: TierRow[];
}

/**
 * The list id and rows are captured when the save is queued, so a flush on unmount can't
 * send the board a stage reset emptied, or send it under a list the stage switched to.
 */
export function useTierListAutosave(tierListId: string): TierListAutosave {
  const updateTierList = useUpdateTierList();
  const dirty = useTierListBuilderStore((state) => state.dirty);

  const save = ({ id, rows }: QueuedSave) => {
    updateTierList.mutate(
      { id, tiers: rows },
      {
        onSuccess: () => {
          useTierListBuilderStore.getState().markSaved(rows);
        },
        // No toast here: the QueryClient's default mutation onError owns the
        // error message for every mutation.
      },
    );
  };

  const saver = useDebouncer(save, {
    wait: AUTOSAVE_WAIT_MS,
    // Must flush the queued save on unmount; cancelling would drop the last few seconds of ranking.
    onUnmount: (debouncer) => debouncer.flush(),
  });

  useEffect(() => {
    const unsubscribe = useTierListBuilderStore.subscribe((state) => {
      // `dirty` separates an edit from the seeding load; the id guard blocks
      // writing back over a draft that has moved to another list.
      if (state.dirty && state.listId === tierListId) {
        saver.maybeExecute({ id: tierListId, rows: state.rows });
      }
    });
    return unsubscribe;
  }, [saver, tierListId]);

  const retry = () => {
    const state = useTierListBuilderStore.getState();
    if (state.dirty && state.listId === tierListId) {
      saver.cancel();
      save({ id: tierListId, rows: state.rows });
    }
  };

  let status: TierListAutosaveStatus = "saved";
  if (updateTierList.isPending) {
    status = "saving";
  } else if (updateTierList.isError && dirty) {
    status = "failed";
  } else if (dirty) {
    status = "saving";
  }

  return { status, flush: saver.flush, retry };
}
