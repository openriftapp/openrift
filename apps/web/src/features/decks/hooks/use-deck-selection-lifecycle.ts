import { useEffect } from "react";

import { useDeckSelectionStore } from "@/features/decks/stores/deck-selection-store";

const OWNS_ESCAPE = '[role="dialog"], [role="alertdialog"], [role="menu"], input, textarea';

/** Escape leaves select mode unless a dialog, menu or text field takes the key; leaving the page does too. */
export function useDeckSelectionLifecycle(): void {
  const selectMode = useDeckSelectionStore((state) => state.selectMode);

  useEffect(() => () => useDeckSelectionStore.getState().resetSelection(), []);

  useEffect(() => {
    if (!selectMode) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) {
        return;
      }
      if (event.target instanceof Element && event.target.closest(OWNS_ESCAPE)) {
        return;
      }
      useDeckSelectionStore.getState().resetSelection();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selectMode]);
}
