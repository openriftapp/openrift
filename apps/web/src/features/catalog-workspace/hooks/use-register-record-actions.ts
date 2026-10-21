import { useEffect, useState } from "react";

import type { WorkspaceRecordActions } from "@/features/catalog-workspace/stores/workspace-actions-store";
import { useWorkspaceActionsStore } from "@/features/catalog-workspace/stores/workspace-actions-store";

export type RecordActions = WorkspaceRecordActions;

export function useRegisterRecordActions(actions: RecordActions): void {
  // oxlint-disable-next-line react/hook-use-state -- setter is never needed; a stable per-mount owner token
  const [owner] = useState(() => Symbol("record-actions"));

  useEffect(() => {
    useWorkspaceActionsStore.getState().register(actions, owner);
  });

  useEffect(() => () => useWorkspaceActionsStore.getState().unregister(owner), [owner]);
}
