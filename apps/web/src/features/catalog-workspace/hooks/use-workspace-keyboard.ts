import type { WorkspaceOwner } from "@openrift/shared/contracts/admin/catalog-workspace";
import { useEffect, useEffectEvent, useState } from "react";
import { toast } from "sonner";

import { useQueueNavigation } from "@/features/catalog-workspace/hooks/use-queue-navigation";
import { useWorkspaceUndo } from "@/features/catalog-workspace/hooks/use-workspace-undo";
import type { WorkspaceKeyAction } from "@/features/catalog-workspace/lib/workspace-keys";
import { SUGGESTION_KEYS, WORKSPACE_KEYS } from "@/features/catalog-workspace/lib/workspace-keys";
import type { WorkspaceUndoEntry } from "@/features/catalog-workspace/lib/workspace-undo";
import type { WorkspaceWriteQueue } from "@/features/catalog-workspace/lib/workspace-write-queue";
import { createWorkspaceWriteQueue } from "@/features/catalog-workspace/lib/workspace-write-queue";
import type { WorkspaceRecordActions } from "@/features/catalog-workspace/stores/workspace-actions-store";
import {
  registrationIsStale,
  useWorkspaceActionsStore,
} from "@/features/catalog-workspace/stores/workspace-actions-store";
import { useWorkspaceSelectionStore } from "@/features/catalog-workspace/stores/workspace-selection-store";
import { isTypingTarget } from "@/lib/keyboard-target";
import { openOverlayPresent } from "@/lib/open-overlay";

const RECORD_WRITES: ReadonlySet<WorkspaceKeyAction> = new Set([
  "settle-and-next",
  "accept-new",
  "ignore",
  "use-suggestion",
]);

const CONTROL_SELECTOR = 'button, [role="button"], [role="menuitem"], [role="option"]';

export const STILL_SAVING_NOTICE =
  "This record is still saving. Press the key again once the save lands.";

export const RECORD_LOADING_NOTICE =
  "The next record is still loading. Press the key again once it shows.";

export const NOTHING_SAVED_NOTICE = "Nothing to undo: the change before it did not save.";

export interface WorkspaceKeyDeps {
  goNext: () => void;
  goPrev: () => void;
  skipToEnd: () => void;
  actions: WorkspaceRecordActions | null;
  /** The registration that owns `actions`. */
  record: symbol | null;
  /** True while `actions` belong to a record being left or loading, or none has registered. */
  stale: boolean;
  currentRecord: () => symbol | null;
  /** Undoes the newest entry unless it is in `skip`. */
  undo: (skip?: ReadonlySet<WorkspaceUndoEntry>) => boolean;
  undoEntries: () => readonly WorkspaceUndoEntry[];
  overlayOpen: () => boolean;
  queue: WorkspaceWriteQueue;
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

function queueUndo(deps: WorkspaceKeyDeps): void {
  const before = new Set(deps.undoEntries());
  void deps.queue.enqueue(null, () => {
    if (!deps.undo(before)) {
      toast(NOTHING_SAVED_NOTICE);
    }
  });
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
  const nothingToSettle = resolved.action === "settle-and-next" && actions?.primary === undefined;
  if (RECORD_WRITES.has(resolved.action) && !nothingToSettle) {
    if (deps.stale) {
      toast(RECORD_LOADING_NOTICE);
      return true;
    }
    if (deps.queue.holds(deps.record)) {
      toast(STILL_SAVING_NOTICE);
      return true;
    }
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
      if (primary.disabled === true) {
        return true;
      }
      void deps.queue.enqueue(deps.record, async () => {
        await primary.run();
        if (deps.currentRecord() === deps.record) {
          deps.goNext();
        }
      });
      return true;
    }
    case "accept-new": {
      const accept = actions?.accept;
      if (accept === undefined) {
        return false;
      }
      void deps.queue.enqueue(deps.record, accept);
      return true;
    }
    case "ignore": {
      const ignore = actions?.ignore;
      if (ignore === undefined) {
        return false;
      }
      void deps.queue.enqueue(deps.record, ignore);
      return true;
    }
    case "undo": {
      if (deps.queue.idle()) {
        return deps.undo();
      }
      queueUndo(deps);
      return true;
    }
    case "use-suggestion": {
      if (actions?.useSuggestion === undefined || resolved.digit === undefined) {
        return false;
      }
      const apply = actions.useSuggestion;
      const { digit } = resolved;
      void deps.queue.enqueue(deps.record, () => apply(digit));
      return true;
    }
  }
}

export function useWorkspaceKeyboard(owner: WorkspaceOwner): void {
  const navigation = useQueueNavigation(owner);
  const { undoLatest } = useWorkspaceUndo();
  // oxlint-disable-next-line react/hook-use-state -- setter is never needed; one queue per mount
  const [queue] = useState(createWorkspaceWriteQueue);

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const registration = useWorkspaceActionsStore.getState();
    const handled = handleWorkspaceKey(event, {
      goNext: navigation.goNext,
      goPrev: navigation.goPrev,
      skipToEnd: navigation.skipToEnd,
      actions: registration.actions,
      record: registration.owner,
      stale: registrationIsStale(registration),
      currentRecord: () => useWorkspaceActionsStore.getState().owner,
      undo: undoLatest,
      undoEntries: () => useWorkspaceSelectionStore.getState().undoStack,
      overlayOpen: openOverlayPresent,
      queue,
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
