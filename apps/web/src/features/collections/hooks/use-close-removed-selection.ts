import { useEffect } from "react";

import { closeOverlayHistoryEntry } from "@/features/cards/hooks/use-overlay-history-entry";
import { useResolvedSelection } from "@/hooks/use-resolved-selection";
import type { CardViewerItem } from "@/lib/card-viewer-types";
import { useSelectionStore } from "@/stores/selection-store";

export function useCloseRemovedSelection(items: readonly CardViewerItem[]): void {
  const hasSelection = useSelectionStore((s) => s.selectedCard !== null);
  const closeDetail = useSelectionStore((s) => s.closeDetail);
  const { card } = useResolvedSelection(items);
  const removed = hasSelection && card === null;

  useEffect(() => {
    if (removed) {
      closeOverlayHistoryEntry("cardDetail", closeDetail);
    }
  }, [removed, closeDetail]);
}
