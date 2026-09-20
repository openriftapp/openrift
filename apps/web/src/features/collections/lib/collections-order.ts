import type { CollectionResponse } from "@openrift/shared/types/api/collection";

// Must match the order of the API's listAccessibleForUser.
export function compareCollections(a: CollectionResponse, b: CollectionResponse): number {
  if ((a.groupId === null) !== (b.groupId === null)) {
    return a.groupId === null ? -1 : 1;
  }
  const byGroupName = (a.groupName ?? "").localeCompare(b.groupName ?? "");
  if (byGroupName !== 0) {
    return byGroupName;
  }
  if (a.isInbox !== b.isInbox) {
    return a.isInbox ? -1 : 1;
  }
  if (a.sortOrder !== b.sortOrder) {
    return a.sortOrder - b.sortOrder;
  }
  return a.name.localeCompare(b.name);
}
