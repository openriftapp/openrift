import { useEffect } from "react";

import type { WorkspaceRecordActions } from "@/features/catalog-workspace/stores/workspace-actions-store";
import { useWorkspaceActionsStore } from "@/features/catalog-workspace/stores/workspace-actions-store";
import { useConstant } from "@/lib/use-constant";

export type RecordActions = WorkspaceRecordActions;

export function useRegisterRecordActions(actions: RecordActions): void {
  const owner = useConstant(() => Symbol("record-actions"));

  useEffect(() => {
    useWorkspaceActionsStore.getState().register(actions, owner);
  });

  useEffect(() => () => useWorkspaceActionsStore.getState().unregister(owner), [owner]);
}
