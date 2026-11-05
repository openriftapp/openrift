export function collapseFilterOptions(
  options: readonly string[],
  hideable: ReadonlySet<string>,
  pinned: readonly string[],
): { visible: string[]; hiddenCount: number } {
  if (options.every((option) => hideable.has(option))) {
    return { visible: [...options], hiddenCount: 0 };
  }
  const visible = options.filter((option) => !hideable.has(option) || pinned.includes(option));
  return { visible, hiddenCount: options.length - visible.length };
}
