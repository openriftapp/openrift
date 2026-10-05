import type { Printing } from "@openrift/shared/types/catalog";

import { useGridFocusStore } from "@/features/cards/stores/grid-focus-store";
import type { SiblingOverrideScope } from "@/features/cards/stores/sibling-override-store";
import { useSiblingOverrideStore } from "@/features/cards/stores/sibling-override-store";

/**
 * Focus, flash and sibling-override state for one grid cell. The override only
 * applies in the cards view, where a cell stands for every printing of a card.
 */
export function useCellDisplayState({
  printing,
  itemId,
  siblings,
  scope,
  inCardsView,
}: {
  printing: Printing;
  itemId: string;
  siblings: readonly Printing[] | undefined;
  scope: SiblingOverrideScope;
  inCardsView: boolean;
}): { displayPrinting: Printing; isSelected: boolean; isFlashing: boolean } {
  const isSelected = useGridFocusStore(
    (s) => s.selectedItemId === itemId || s.selectedItemId === printing.id,
  );
  const isFlashing = useGridFocusStore(
    (s) => s.flashCardId === itemId || s.flashCardId === printing.id,
  );
  const overrideId = useSiblingOverrideStore((s) =>
    inCardsView ? s.overrides[scope].get(printing.cardId) : undefined,
  );
  const displayPrinting =
    overrideId && siblings
      ? (siblings.find((sibling) => sibling.id === overrideId) ?? printing)
      : printing;
  return { displayPrinting, isSelected, isFlashing };
}
