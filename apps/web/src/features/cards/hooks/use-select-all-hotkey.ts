import { useHotkey } from "@tanstack/react-hotkeys";

import { useGridSelectionStore } from "@/features/cards/stores/grid-selection-store";

const OVERLAY_SELECTOR = '[role="dialog"],[role="alertdialog"],[role="menu"],[role="listbox"]';

export function useSelectAllHotkey(selectableIds: string[], enabled: boolean) {
  useHotkey(
    "Mod+A",
    (event) => {
      if (document.activeElement?.closest(OVERLAY_SELECTOR)) {
        return;
      }
      event.preventDefault();
      useGridSelectionStore.getState().enterSelectAll(selectableIds);
    },
    {
      enabled: enabled && selectableIds.length > 0,
      ignoreInputs: true,
      preventDefault: false,
      stopPropagation: false,
    },
  );
}
