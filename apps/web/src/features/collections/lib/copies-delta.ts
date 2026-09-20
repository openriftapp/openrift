import type { CopyResponse } from "@openrift/shared/types/api/collection";

/**
 * Deletions apply before the changed rows: a row in both was re-added after its
 * tombstone, and the changed set only holds rows the server still has.
 */
export function mergeCopiesDelta(
  previous: readonly CopyResponse[],
  changed: readonly CopyResponse[],
  deletedIds: readonly string[],
): CopyResponse[] {
  const removed = new Set(deletedIds);
  const byId = new Map<string, CopyResponse>();
  for (const row of previous) {
    if (!removed.has(row.id)) {
      byId.set(row.id, row);
    }
  }
  for (const row of changed) {
    byId.set(row.id, row);
  }
  return [...byId.values()];
}
