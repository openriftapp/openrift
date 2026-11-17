import { create } from "zustand";

import { isTypingTarget } from "@/lib/keyboard-target";
import { openOverlayPresent } from "@/lib/open-overlay";

interface WorkspaceRecordPaneState {
  pane: HTMLElement | null;
  setPane: (pane: HTMLElement | null) => void;
}

export const useWorkspaceRecordPaneStore = create<WorkspaceRecordPaneState>()((set) => ({
  pane: null,
  setPane: (pane) => set({ pane }),
}));

/** Focuses the record pane unless a field is being typed in or an overlay is open. */
export function focusRecordPane(): void {
  const { pane } = useWorkspaceRecordPaneStore.getState();
  if (pane === null || isTypingTarget(document.activeElement) || openOverlayPresent()) {
    return;
  }
  pane.focus({ preventScroll: true });
}
