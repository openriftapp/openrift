import { workspaceWriteQueue } from "@/features/catalog-workspace/lib/workspace-write-queue";
import { useWorkspaceActionsStore } from "@/features/catalog-workspace/stores/workspace-actions-store";

/**
 * Queues a button's write behind earlier workspace writes and undos, under the registered record.
 * Never call it from inside a queued task: that task would wait on itself.
 */
export function queueWorkspaceWrite(task: () => unknown): Promise<boolean> {
  return workspaceWriteQueue().enqueue(useWorkspaceActionsStore.getState().owner, task);
}

export function queuedWorkspaceWrite<A extends unknown[]>(
  write: (...args: A) => unknown,
): (...args: A) => Promise<boolean> {
  return (...args) => queueWorkspaceWrite(() => write(...args));
}
