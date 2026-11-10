export interface SplitSelection<T> {
  selected: T[];
  hiddenCount: number;
}

/** Ticked rows that left `loaded` altogether are dropped; ticked rows the filter hides are kept. */
export function splitSelection<T>(
  loaded: readonly T[],
  visible: readonly T[],
  keyOf: (row: T) => string,
  ticked: ReadonlySet<string>,
): SplitSelection<T> {
  const visibleKeys = new Set(visible.map((row) => keyOf(row)));
  const selected = loaded.filter((row) => ticked.has(keyOf(row)));
  const hiddenCount = selected.filter((row) => !visibleKeys.has(keyOf(row))).length;
  return { selected, hiddenCount };
}

export function selectionSummary(selectedCount: number, hiddenCount: number): string {
  const base = `${selectedCount} selected`;
  return hiddenCount === 0 ? base : `${base}, ${hiddenCount} hidden by filter`;
}
