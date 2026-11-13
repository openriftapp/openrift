import type { WorkspaceOwner } from "@openrift/shared/contracts/admin/catalog-workspace";
import { useEffect, useEffectEvent, useRef } from "react";

import { useQueueNavigation } from "@/features/catalog-workspace/hooks/use-queue-navigation";
import { useWorkspaceUndo } from "@/features/catalog-workspace/hooks/use-workspace-undo";
import type { WorkspaceKeyAction } from "@/features/catalog-workspace/lib/workspace-keys";
import { SUGGESTION_KEYS, WORKSPACE_KEYS } from "@/features/catalog-workspace/lib/workspace-keys";
import type { WorkspaceRecordActions } from "@/features/catalog-workspace/stores/workspace-actions-store";
import { useWorkspaceActionsStore } from "@/features/catalog-workspace/stores/workspace-actions-store";
import { isTypingTarget } from "@/lib/keyboard-target";
import { runReportedMutation } from "@/lib/run-reported-mutation";

const OVERLAY_SELECTOR = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]';

const CONTROL_SELECTOR = 'button, [role="button"], [role="menuitem"], [role="option"]';

export interface WorkspaceKeyDeps {
  goNext: () => void;
  goPrev: () => void;
  skipToEnd: () => void;
  actions: WorkspaceRecordActions | null;
  undo: () => boolean;
  overlayOpen: () => boolean;
  busy: { current: boolean };
}

type KeyEventLike = Pick<
  KeyboardEvent,
  "key" | "target" | "ctrlKey" | "metaKey" | "altKey" | "repeat" | "defaultPrevented"
>;

export function workspaceKeyAction(
  event: KeyEventLike,
): { action: WorkspaceKeyAction; digit?: number } | null {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) {
    return null;
  }
  if (isTypingTarget(event.target)) {
    return null;
  }
  const digitIndex = (SUGGESTION_KEYS as readonly string[]).indexOf(event.key);
  if (digitIndex !== -1) {
    return { action: "use-suggestion", digit: digitIndex + 1 };
  }
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  const binding = WORKSPACE_KEYS.find((entry) => entry.key === key);
  if (binding === undefined) {
    return null;
  }
  if (
    binding.action === "settle-and-next" &&
    event.target instanceof Element &&
    event.target.closest(CONTROL_SELECTOR) !== null
  ) {
    return null;
  }
  return { action: binding.action };
}

async function settleAndNext(
  primary: NonNullable<WorkspaceRecordActions["primary"]>,
  next: () => void,
) {
  const done = await runReportedMutation(async () => {
    await primary.run();
  });
  if (done) {
    next();
  }
}

async function runExclusive(
  busy: { current: boolean },
  task: () => Promise<unknown> | unknown,
): Promise<void> {
  busy.current = true;
  await runReportedMutation(async () => {
    await task();
  });
  busy.current = false;
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
  switch (resolved.action) {
    case "next": {
      deps.goNext();
      return true;
    }
    case "previous": {
      deps.goPrev();
      return true;
    }
    case "skip": {
      deps.skipToEnd();
      return true;
    }
    case "settle-and-next": {
      const primary = actions?.primary;
      if (primary === undefined) {
        deps.goNext();
        return true;
      }
      if (primary.disabled === true || deps.busy.current) {
        return true;
      }
      void runExclusive(deps.busy, () => settleAndNext(primary, deps.goNext));
      return true;
    }
    case "accept-new": {
      const accept = actions?.accept;
      if (accept === undefined) {
        return false;
      }
      if (!deps.busy.current) {
        void runExclusive(deps.busy, accept);
      }
      return true;
    }
    case "ignore": {
      const ignore = actions?.ignore;
      if (ignore === undefined) {
        return false;
      }
      if (!deps.busy.current) {
        void runExclusive(deps.busy, ignore);
      }
      return true;
    }
    case "undo": {
      return deps.undo();
    }
    case "use-suggestion": {
      if (actions?.useSuggestion === undefined || resolved.digit === undefined) {
        return false;
      }
      if (!deps.busy.current) {
        const apply = actions.useSuggestion;
        const { digit } = resolved;
        void runExclusive(deps.busy, () => apply(digit));
      }
      return true;
    }
  }
}

function overlayOpen(): boolean {
  return document.querySelector(OVERLAY_SELECTOR) !== null;
}

export function useWorkspaceKeyboard(owner: WorkspaceOwner): void {
  const navigation = useQueueNavigation(owner);
  const { undoLatest } = useWorkspaceUndo();
  const busy = useRef(false);

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const handled = handleWorkspaceKey(event, {
      goNext: navigation.goNext,
      goPrev: navigation.goPrev,
      skipToEnd: navigation.skipToEnd,
      actions: useWorkspaceActionsStore.getState().actions,
      undo: undoLatest,
      overlayOpen,
      busy,
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
