import { useRef } from "react";

import { useScopeEffect } from "@/hooks/use-scope-effect";

/**
 * Brings the selected card back into view when a filter, search or sort change (a new `listKey`)
 * moves it to another row. A list that changes under an unchanged key (an add, a refetch) is
 * not followed; a new selection or a new `layout` (the grid's column count) is followed elsewhere.
 */
export function useFollowSelectedRow(
  selectedItemId: string | undefined,
  rowIndex: number,
  layout: number,
  listKey: string,
  scrollToCard: (itemId: string) => void,
) {
  const previousRef = useRef({ selectedItemId, rowIndex, layout, listKey });
  useScopeEffect(`${selectedItemId} ${rowIndex} ${layout}`, () => {
    const previous = previousRef.current;
    previousRef.current = { selectedItemId, rowIndex, layout, listKey };
    if (
      selectedItemId &&
      rowIndex !== -1 &&
      previous.selectedItemId === selectedItemId &&
      previous.layout === layout &&
      previous.rowIndex !== rowIndex &&
      previous.listKey !== listKey
    ) {
      scrollToCard(selectedItemId);
    }
  });
}
