import { toError } from "@openrift/shared/strings";
import type { QueryClient } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { WorkspaceUndoEntry } from "@/features/catalog-workspace/lib/workspace-undo";
import { goneNotice } from "@/features/catalog-workspace/lib/workspace-undo";
import type { WorkspaceWriteQueue } from "@/features/catalog-workspace/lib/workspace-write-queue";
import { workspaceWriteQueue } from "@/features/catalog-workspace/lib/workspace-write-queue";
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

const UNDO_TASK = Symbol("workspace-undo");

export const NOTHING_SAVED_NOTICE = "Nothing to undo: the change before it did not save.";

/** Runs a queued undo unless an earlier failed undo dropped it; a failure drops the waiting ones. */
async function runQueuedUndo(entry: WorkspaceUndoEntry, queryClient: QueryClient): Promise<void> {
  if (!useWorkspaceSelectionStore.getState().undoQueue.includes(entry)) {
    return;
  }
  const ok = await undoOne(entry, queryClient);
  const after = useWorkspaceSelectionStore.getState();
  const rest = ok
    ? after.undoQueue.filter((queued) => queued !== entry && after.undoStack.includes(queued))
    : [];
  after.setUndoQueue(rest);
  after.setUndoing(rest.length > 0);
}

function markQueued(entry: WorkspaceUndoEntry): boolean {
  const store = useWorkspaceSelectionStore.getState();
  if (!store.undoStack.includes(entry) || store.undoQueue.includes(entry)) {
    return false;
  }
  store.setUndoQueue([...store.undoQueue, entry]);
  store.setUndoing(true);
  return true;
}

/** Queues the undo behind every workspace write and undo asked for before it. */
export async function runWorkspaceUndo(
  entry: WorkspaceUndoEntry,
  queryClient: QueryClient,
  queue: WorkspaceWriteQueue = workspaceWriteQueue(),
): Promise<void> {
  if (markQueued(entry)) {
    await queue.enqueue(UNDO_TASK, () => runQueuedUndo(entry, queryClient));
  }
}

function latestUndo(): WorkspaceUndoEntry | undefined {
  const { undoStack, undoQueue } = useWorkspaceSelectionStore.getState();
  return undoStack.findLast((candidate) => !undoQueue.includes(candidate));
}

/**
 * Undoes the newest entry. While a write is queued, waits for it and undoes the entry it adds,
 * so an entry already on the stack when Z was pressed stays.
 */
export function undoLatestWorkspaceStep(
  queryClient: QueryClient,
  queue: WorkspaceWriteQueue = workspaceWriteQueue(),
): boolean {
  if (queue.holdsOnly(UNDO_TASK)) {
    const entry = latestUndo();
    if (entry === undefined) {
      return false;
    }
    void runWorkspaceUndo(entry, queryClient, queue);
    return true;
  }
  const before = new Set(useWorkspaceSelectionStore.getState().undoStack);
  void queue.enqueue(UNDO_TASK, async () => {
    const entry = latestUndo();
    if (entry === undefined || before.has(entry) || !markQueued(entry)) {
      toast(NOTHING_SAVED_NOTICE);
      return;
    }
    await runQueuedUndo(entry, queryClient);
  });
  return true;
}

export function useWorkspaceUndo() {
  const queryClient = useQueryClient();
  const pushUndo = useWorkspaceSelectionStore((state) => state.pushUndo);

  const undoEntry = (entry: WorkspaceUndoEntry) => {
    void runWorkspaceUndo(entry, queryClient);
  };

  const undoLatest = (): boolean => undoLatestWorkspaceStep(queryClient);

  const announce = (entry: WorkspaceUndoEntry) => {
    pushUndo(entry);
    toast.success(entry.label, {
      action: { label: "Undo (Z)", onClick: () => undoEntry(entry) },
    });
  };

  return { push: pushUndo, announce, undoEntry, undoLatest };
}
