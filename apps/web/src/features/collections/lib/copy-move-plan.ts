/** How many of `copyIds` already sit in each collection; unknown copies count nowhere. */
export function alreadyInCollectionCounts(
  copyIds: readonly string[],
  collectionIdByCopyId: ReadonlyMap<string, string>,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const copyId of new Set(copyIds)) {
    const collectionId = collectionIdByCopyId.get(copyId);
    if (collectionId !== undefined) {
      counts.set(collectionId, (counts.get(collectionId) ?? 0) + 1);
    }
  }
  return counts;
}

export function copyIdsToMove(
  copyIds: readonly string[],
  collectionIdByCopyId: ReadonlyMap<string, string>,
  targetCollectionId: string,
): string[] {
  return [...new Set(copyIds)].filter(
    (copyId) => collectionIdByCopyId.get(copyId) !== targetCollectionId,
  );
}
