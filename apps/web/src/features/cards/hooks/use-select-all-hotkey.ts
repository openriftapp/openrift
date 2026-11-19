import { useHotkey } from "@tanstack/react-hotkeys";

import { useGridSelectionStoreApi } from "@/features/cards/stores/grid-selection-store";

const OVERLAY_SELECTOR = '[role="dialog"],[role="alertdialog"],[role="menu"],[role="listbox"]';

export function useSelectAllHotkey(selectableIds: string[], enabled: boolean) {
  const selection = useGridSelectionStoreApi();
  useHotkey(
    "Mod+A",
    (event) => {
      if (document.activeElement?.closest(OVERLAY_SELECTOR)) {
        return;
      }
      event.preventDefault();
      selection.getState().enterSelectAll(selectableIds);
    },
    {
      enabled: enabled && selectableIds.length > 0,
      ignoreInputs: true,
      preventDefault: false,
      stopPropagation: false,
    },
  );
}
