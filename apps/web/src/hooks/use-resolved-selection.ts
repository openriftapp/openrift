import type { CardViewerItem } from "@/lib/card-viewer-types";
import type { ResolvedSelection } from "@/lib/resolve-selection";
import { resolveSelection } from "@/lib/resolve-selection";
import { useSelectionStore } from "@/stores/selection-store";

export function useResolvedSelection(items: readonly CardViewerItem[]): ResolvedSelection {
  const selectedCard = useSelectionStore((s) => s.selectedCard);
  const selectedItemId = useSelectionStore((s) => s.selectedItemId);
  const selectedZone = useSelectionStore((s) => s.selectedZone);
  const sourceIds = useSelectionStore((s) => s.sourceIds);
  return resolveSelection({ selectedCard, selectedItemId, selectedZone, sourceIds }, items);
}
