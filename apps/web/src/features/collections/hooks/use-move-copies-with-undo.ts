import { toast } from "sonner";

import { useMoveCopies } from "@/features/collections/hooks/use-copies";
import type { MovedCopy } from "@/features/collections/hooks/use-copies";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { m } from "@/paraglide/messages.js";

interface UndoAction {
  label: string;
  onClick: () => void;
}

export function useMoveCopiesWithUndo() {
  const moveCopies = useMoveCopies();

  const moveBack = async (moved: readonly MovedCopy[], onUndone?: () => void) => {
    const batches = Map.groupBy(moved, (entry) => entry.fromCollectionId);
    let movedBack = 0;
    for (const [toCollectionId, entries] of batches) {
      const copyIds = entries.map((entry) => entry.copyId);
      const ok = await runReportedMutation(() =>
        moveCopies.mutateAsync({ copyIds, toCollectionId }),
      );
      if (ok) {
        movedBack += copyIds.length;
      }
    }
    if (movedBack > 0) {
      toast.success(m.collections_toast_moved_back({ count: movedBack }));
      onUndone?.();
    }
  };

  /** Resolves `undefined` when the move failed; the error toast is already up. */
  const move = async (
    copyIds: string[],
    toCollectionId: string,
    onUndone?: () => void,
  ): Promise<{ undo?: UndoAction } | undefined> => {
    let moved: MovedCopy[] | undefined;
    const ok = await runReportedMutation(async () => {
      moved = await moveCopies.mutateAsync({ copyIds, toCollectionId });
    });
    if (!ok) {
      return undefined;
    }
    if (!moved || moved.length === 0) {
      return {};
    }
    const origins = moved;
    return {
      undo: { label: m.collections_toast_undo(), onClick: () => void moveBack(origins, onUndone) },
    };
  };

  return { move, isPending: moveCopies.isPending };
}
