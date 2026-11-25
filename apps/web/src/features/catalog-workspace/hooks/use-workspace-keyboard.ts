import type { QueryClient } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useEffectEvent } from "react";
import { toast } from "sonner";

import { useWorkspaceUndo } from "@/features/catalog-workspace/hooks/use-workspace-undo";
import type { WorkspaceKeyAction } from "@/features/catalog-workspace/lib/workspace-keys";
import { WORKSPACE_KEYS } from "@/features/catalog-workspace/lib/workspace-keys";
import type { WorkspaceWriteQueue } from "@/features/catalog-workspace/lib/workspace-write-queue";
import { workspaceWriteQueue } from "@/features/catalog-workspace/lib/workspace-write-queue";
import type { WorkspaceRecordActions } from "@/features/catalog-workspace/stores/workspace-actions-store";
import {
  registrationIsStale,
  useWorkspaceActionsStore,
} from "@/features/catalog-workspace/stores/workspace-actions-store";
import { isTypingTarget } from "@/lib/keyboard-target";
import { openOverlayPresent } from "@/lib/open-overlay";

const RECORD_WRITES: ReadonlySet<WorkspaceKeyAction> = new Set([
  "accept-new",
  "ignore",
  "dismiss-all",
]);

const RECORD_KEYS: ReadonlySet<WorkspaceKeyAction> = new Set([
  "accept-new",
  "ignore",
  "dismiss-all",
  "undo",
]);

const CONTROL_SELECTOR = 'a[href], button, [role="button"], [role="menuitem"], [role="option"]';

export const STILL_SAVING_NOTICE =
  "This record is still saving. Press the key again once the save lands.";

export const RECORD_LOADING_NOTICE =
  "This record is still loading. Press the key again once it shows.";

interface WorkspaceNavigation {
  goNext: () => void;
  goPrev: () => void;
}

export interface WorkspaceKeyDeps extends WorkspaceNavigation {
  actions: WorkspaceRecordActions | null;
  record: symbol | null;
  stale: boolean;
  undo: () => boolean;
  overlayOpen: () => boolean;
  queue: WorkspaceWriteQueue;
  queryClient: QueryClient;
}

type KeyEventLike = Pick<
  KeyboardEvent,
  "key" | "target" | "ctrlKey" | "metaKey" | "altKey" | "repeat" | "defaultPrevented"
>;

export function workspaceKeyAction(event: KeyEventLike): { action: WorkspaceKeyAction } | null {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) {
    return null;
  }
  if (isTypingTarget(event.target)) {
    return null;
  }
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  const binding = WORKSPACE_KEYS.find((entry) => entry.key === key);
  if (binding === undefined) {
    return null;
  }
  if (
    binding.action === "advance" &&
    event.target instanceof Element &&
    event.target.closest(CONTROL_SELECTOR) !== null
  ) {
    return null;
  }
  return { action: binding.action };
}

export function handleWorkspaceKey(event: KeyEventLike, deps: WorkspaceKeyDeps): boolean {
  const resolved = workspaceKeyAction(event);
  if (resolved === null || deps.overlayOpen()) {
    return false;
  }
  const { actions } = deps;
  const repeatable = resolved.action === "next" || resolved.action === "previous";
  if (event.repeat && !repeatable) {
    return true;
  }
  const guarded = resolved.action === "advance" || RECORD_WRITES.has(resolved.action);
  if (guarded && deps.stale) {
    toast(RECORD_LOADING_NOTICE);
    return true;
  }
  if (RECORD_WRITES.has(resolved.action) && deps.queue.holds(deps.record)) {
    toast(STILL_SAVING_NOTICE);
    return true;
  }
  switch (resolved.action) {
    case "next":
    case "advance": {
      deps.goNext();
      return true;
    }
    case "previous": {
      deps.goPrev();
      return true;
    }
    case "accept-new": {
      const accept = actions?.accept;
      if (accept === undefined) {
        return false;
      }
      void deps.queue.enqueue(deps.record, accept, {
        queryClient: deps.queryClient,
        limit: actions?.acceptLimit,
      });
      return true;
    }
    case "ignore": {
      const ignore = actions?.ignore;
      if (ignore === undefined) {
        return false;
      }
      void deps.queue.enqueue(deps.record, ignore, { queryClient: deps.queryClient });
      return true;
    }
    case "dismiss-all": {
      const dismissAll = actions?.dismissAll;
      if (dismissAll === undefined) {
        return false;
      }
      void deps.queue.enqueue(deps.record, dismissAll, { queryClient: deps.queryClient });
      return true;
    }
    case "undo": {
      return deps.undo();
    }
  }
}

export function useWorkspaceKeyboard(navigation?: WorkspaceNavigation): void {
  const { undoLatest } = useWorkspaceUndo();
  const queryClient = useQueryClient();

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const action = workspaceKeyAction(event)?.action;
    if (navigation === undefined && (action === undefined || !RECORD_KEYS.has(action))) {
      return;
    }
    const registration = useWorkspaceActionsStore.getState();
    const handled = handleWorkspaceKey(event, {
      goNext: () => navigation?.goNext(),
      goPrev: () => navigation?.goPrev(),
      actions: registration.actions,
      record: registration.owner,
      stale: registrationIsStale(registration),
      undo: undoLatest,
      overlayOpen: openOverlayPresent,
      queue: workspaceWriteQueue(),
      queryClient,
    });
    if (handled) {
      event.preventDefault();
    }
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyDown(event);
    globalThis.addEventListener("keydown", listener);
    return () => globalThis.removeEventListener("keydown", listener);
  }, []);
}
