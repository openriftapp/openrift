import { useEffect } from "react";
import { useStore } from "zustand";

import type { DeckSelectionStore } from "@/features/decks/stores/deck-selection-store";

const OWNS_ESCAPE = '[role="dialog"], [role="alertdialog"], [role="menu"], input, textarea';

/** Escape leaves select mode unless a dialog, menu or text field takes the key; leaving the page does too. */
export function useDeckSelectionLifecycle(selection: DeckSelectionStore): void {
  const selectMode = useStore(selection, (state) => state.selectMode);

  useEffect(() => () => selection.getState().resetSelection(), [selection]);

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
      event.preventDefault();
      selection.getState().resetSelection();
    };
    // On the document so it runs before the detail pane's globalThis listener, which registered first.
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selectMode, selection]);
}
