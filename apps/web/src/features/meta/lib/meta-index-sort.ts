type SortDirection = "asc" | "desc";

export function nextIndexSort<TSort extends string>(
  current: { sort: TSort; direction: SortDirection },
  column: TSort,
  descendingFirst: ReadonlySet<TSort>,
): { sort: TSort; direction: SortDirection } {
  if (current.sort === column) {
    return { sort: column, direction: current.direction === "asc" ? "desc" : "asc" };
  }
  return { sort: column, direction: descendingFirst.has(column) ? "desc" : "asc" };
}

export function sortSearchPatch<TSort extends string>(
  next: { sort: TSort; direction: SortDirection },
  defaults: { sort: TSort; direction: SortDirection },
): { by: TSort | undefined; dir: SortDirection | undefined } {
  const defaultSort = next.sort === defaults.sort;
  return {
    by: defaultSort ? undefined : next.sort,
    dir: defaultSort && next.direction === defaults.direction ? undefined : next.direction,
  };
}
