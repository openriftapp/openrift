import { useRef } from "react";

import { useScopeEffect } from "@/hooks/use-scope-effect";

/**
 * Brings the selected card back into view when a list change moves it to another row.
 * A new selection or a new `layout` (the grid's column count) is followed elsewhere.
 */
export function useFollowSelectedRow(
  selectedItemId: string | undefined,
  rowIndex: number,
  layout: number,
  scrollToCard: (itemId: string) => void,
) {
  const previousRef = useRef({ selectedItemId, rowIndex, layout });
  useScopeEffect(`${selectedItemId} ${rowIndex} ${layout}`, () => {
    const previous = previousRef.current;
    previousRef.current = { selectedItemId, rowIndex, layout };
    if (
      selectedItemId &&
      rowIndex !== -1 &&
      previous.selectedItemId === selectedItemId &&
      previous.layout === layout &&
      previous.rowIndex !== rowIndex
    ) {
      scrollToCard(selectedItemId);
    }
  });
}
