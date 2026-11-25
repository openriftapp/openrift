import type { QueryClient } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";

import type { FieldAcceptMark } from "@/features/admin/lib/accept-undo";
import { markFieldAccept } from "@/features/admin/lib/accept-undo";
import type {
  WorkspaceWriteTask,
  WriteLimit,
} from "@/features/catalog-workspace/lib/workspace-write-queue";
import { workspaceWriteQueue } from "@/features/catalog-workspace/lib/workspace-write-queue";
import { useWorkspaceActionsStore } from "@/features/catalog-workspace/stores/workspace-actions-store";

export type QueueWorkspaceWrite = (
  task: WorkspaceWriteTask,
  options?: { limit?: WriteLimit },
) => Promise<boolean>;

/**
 * Queues a button's write behind earlier workspace writes and undos, under the registered record.
 * Never call it from inside a queued task: that task would wait on itself.
 */
export function queueWorkspaceWrite(
  queryClient: QueryClient,
  task: WorkspaceWriteTask,
  options?: { limit?: WriteLimit },
): Promise<boolean> {
  return workspaceWriteQueue().enqueue(useWorkspaceActionsStore.getState().owner, task, {
    ...options,
    queryClient,
  });
}

export function useQueueWorkspaceWrite(): QueueWorkspaceWrite {
  const queryClient = useQueryClient();
  return (task, options) => queueWorkspaceWrite(queryClient, task, options);
}

export function queuedFieldWrite<A extends unknown[]>(
  queue: QueueWorkspaceWrite,
  write: (signal: AbortSignal, mark: FieldAcceptMark, ...args: A) => unknown,
): (...args: A) => Promise<boolean> {
  return (...args) => {
    const mark = markFieldAccept();
    return queue((signal) => write(signal, mark, ...args));
  };
}
