import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

import { useWorkspaceUndoStore } from "@/features/catalog-workspace/stores/workspace-undo-store";

const WORKSPACE_PATH = /(?:^|\/)admin\/workspace(?:\/|$)/u;

export function isWorkspacePath(pathname: string): boolean {
  return WORKSPACE_PATH.test(pathname);
}

export function useClearUndoOnLeave(): void {
  const router = useRouter();
  useEffect(
    () => () => {
      if (!isWorkspacePath(router.latestLocation.pathname)) {
        useWorkspaceUndoStore.getState().clearUndo();
      }
    },
    [router],
  );
}
