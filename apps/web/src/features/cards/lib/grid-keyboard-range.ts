import { defaultRangeExtractor } from "@tanstack/react-virtual";
import type { Range } from "@tanstack/react-virtual";

/**
 * The virtualizer's rows plus the keyboard-focused row and its neighbours, so the row Tab or
 * Shift+Tab moves into next is already mounted when the key lands.
 */
export function keyboardRowRange(range: Range, focusedRow: number | null): number[] {
  const indexes = defaultRangeExtractor(range);
  if (focusedRow === null) {
    return indexes;
  }
  const neighbours = [focusedRow - 1, focusedRow, focusedRow + 1].filter(
    (index) => index >= 0 && index < range.count && !indexes.includes(index),
  );
  return neighbours.length === 0 ? indexes : [...indexes, ...neighbours].toSorted((a, b) => a - b);
}
