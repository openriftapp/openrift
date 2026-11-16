import { toError } from "@openrift/shared/strings";
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

async function undoOne(entry: WorkspaceUndoEntry, queryClient: QueryClient): Promise<boolean> {
  let failure: unknown = null;
  try {
    await entry.undo();
  } catch (error) {
    failure = error ?? new Error("Undo failed");
  }
  const store = useWorkspaceSelectionStore.getState();
  if (failure === null) {
    store.removeUndo(entry);
    toast.success(entry.undoneLabel);
    refresh(entry, queryClient);
    return true;
  }
  if (errorStatus(failure) === 404 && !isStaleServerFnError(failure)) {
    store.removeUndo(entry);
    toast(goneNotice(entry));
    refresh(entry, queryClient);
    return true;
  }
  reportMutationError(toError(failure), queryClient);
  return false;
}

/** An undo asked for while another runs waits its turn; a failed undo drops the waiting ones. */
export async function runWorkspaceUndo(
  entry: WorkspaceUndoEntry,
  queryClient: QueryClient,
): Promise<void> {
  const store = useWorkspaceSelectionStore.getState();
  if (!store.undoStack.includes(entry) || store.undoQueue.includes(entry)) {
    return;
  }
  store.setUndoQueue([...store.undoQueue, entry]);
  if (store.undoing) {
    return;
  }
  store.setUndoing(true);
  let next: WorkspaceUndoEntry | undefined = entry;
  while (next !== undefined) {
    const ok = await undoOne(next, queryClient);
    const after = useWorkspaceSelectionStore.getState();
    const rest = ok
      ? after.undoQueue.slice(1).filter((queued) => after.undoStack.includes(queued))
      : [];
    after.setUndoQueue(rest);
    next = rest[0];
  }
  useWorkspaceSelectionStore.getState().setUndoing(false);
}

export function useWorkspaceUndo() {
  const queryClient = useQueryClient();
  const pushUndo = useWorkspaceSelectionStore((state) => state.pushUndo);

  const undoEntry = (entry: WorkspaceUndoEntry) => {
    void runWorkspaceUndo(entry, queryClient);
  };

  const undoLatest = (): boolean => {
    const { undoStack, undoQueue } = useWorkspaceSelectionStore.getState();
    const entry = undoStack.findLast((candidate) => !undoQueue.includes(candidate));
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
