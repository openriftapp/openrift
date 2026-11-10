import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

import { useWorkspaceSelectionStore } from "@/features/catalog-workspace/stores/workspace-selection-store";

const WORKSPACE_PATH = /(?:^|\/)admin\/workspace(?:\/|$)/u;

export function isWorkspacePath(pathname: string): boolean {
  return WORKSPACE_PATH.test(pathname);
}

export function useClearUndoOnLeave(): void {
  const router = useRouter();
  useEffect(
    () => () => {
      if (!isWorkspacePath(router.latestLocation.pathname)) {
        useWorkspaceSelectionStore.getState().clearUndo();
      }
    },
    [router],
  );
}
