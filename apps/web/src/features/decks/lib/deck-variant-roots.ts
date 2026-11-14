interface VariantTreeMember {
  id: string;
  /** ISO timestamp. */
  updatedAt: string;
}

export function orderVariantRoots<T extends VariantTreeMember>(
  roots: readonly T[],
  childrenOf: (id: string) => readonly T[],
  parents: ReadonlyMap<string, string | null>,
  currentId: string,
): T[] {
  const treeNewest = (member: T): string => {
    let newest = member.updatedAt;
    for (const child of childrenOf(member.id)) {
      const childNewest = treeNewest(child);
      if (childNewest > newest) {
        newest = childNewest;
      }
    }
    return newest;
  };

  let currentRootId = currentId;
  let currentRootParent = parents.get(currentRootId) ?? null;
  while (currentRootParent !== null) {
    currentRootId = currentRootParent;
    currentRootParent = parents.get(currentRootId) ?? null;
  }

  return roots.toSorted((left, right) => {
    const byNewest = treeNewest(left).localeCompare(treeNewest(right));
    if (byNewest !== 0) {
      return byNewest;
    }
    const leftOpen = left.id === currentRootId ? 1 : 0;
    const rightOpen = right.id === currentRootId ? 1 : 0;
    if (leftOpen !== rightOpen) {
      return leftOpen - rightOpen;
    }
    return left.id.localeCompare(right.id);
  });
}
