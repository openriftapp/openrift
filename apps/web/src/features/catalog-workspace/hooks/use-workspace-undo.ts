import type { QueryClient } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { WorkspaceUndoEntry } from "@/features/catalog-workspace/lib/workspace-undo";
import { goneNotice } from "@/features/catalog-workspace/lib/workspace-undo";
import { useWorkspaceSelectionStore } from "@/features/catalog-workspace/stores/workspace-selection-store";
import { reportMutationError } from "@/lib/query-client";
import { errorStatus } from "@/lib/server-fns/api-error";
import { isStaleServerFnError } from "@/lib/stale-bundle-reload";

function refresh(entry: WorkspaceUndoEntry, queryClient: QueryClient) {
  for (const key of entry.invalidates) {
    void queryClient.invalidateQueries({ queryKey: [...key] });
  }
}

export async function runWorkspaceUndo(
  entry: WorkspaceUndoEntry,
  queryClient: QueryClient,
): Promise<void> {
  const store = useWorkspaceSelectionStore.getState();
  if (store.undoing || !store.undoStack.includes(entry)) {
    return;
  }
  store.setUndoing(true);
  let failure: unknown = null;
  try {
    await entry.undo();
  } catch (error) {
    failure = error ?? new Error("Undo failed");
  }
  const after = useWorkspaceSelectionStore.getState();
  after.setUndoing(false);
  if (failure === null) {
    after.removeUndo(entry);
    toast.success(entry.undoneLabel);
    refresh(entry, queryClient);
    return;
  }
  if (errorStatus(failure) === 404 && !isStaleServerFnError(failure)) {
    after.removeUndo(entry);
    toast(goneNotice(entry));
    refresh(entry, queryClient);
    return;
  }
  reportMutationError(failure instanceof Error ? failure : new Error("Undo failed"), queryClient);
}

export function useWorkspaceUndo() {
  const queryClient = useQueryClient();
  const pushUndo = useWorkspaceSelectionStore((state) => state.pushUndo);

  const undoEntry = (entry: WorkspaceUndoEntry) => {
    void runWorkspaceUndo(entry, queryClient);
  };

  const undoLatest = (): boolean => {
    const entry = useWorkspaceSelectionStore.getState().undoStack.at(-1);
    if (entry === undefined) {
      return false;
    }
    undoEntry(entry);
    return true;
  };

  const announce = (entry: WorkspaceUndoEntry) => {
    pushUndo(entry);
    toast.success(entry.label, {
      action: { label: "Undo (Z)", onClick: () => undoEntry(entry) },
    });
  };

  return { push: pushUndo, announce, undoEntry, undoLatest };
}
