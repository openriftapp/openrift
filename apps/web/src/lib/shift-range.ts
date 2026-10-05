/**
 * Returns null when there is no range to extend: nothing was clicked before,
 * or the anchor isn't in `items`.
 */
export function computeShiftRange<T extends { id: string }>(params: {
  items: readonly T[];
  lastSelectedItemId: string | null;
  itemId: string;
  idsForItem: (item: T) => readonly string[];
}): string[] | null {
  const { items, lastSelectedItemId, itemId, idsForItem } = params;
  const startIdx =
    lastSelectedItemId === null ? -1 : items.findIndex((item) => item.id === lastSelectedItemId);
  const endIdx = items.findIndex((item) => item.id === itemId);
  if (startIdx === -1 || endIdx === -1) {
    return null;
  }
  const lo = Math.min(startIdx, endIdx);
  const hi = Math.max(startIdx, endIdx);
  const rangeIds: string[] = [];
  for (const item of items.slice(lo, hi + 1)) {
    rangeIds.push(...idsForItem(item));
  }
  return rangeIds;
}
