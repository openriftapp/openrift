import type { QueryClient } from "@tanstack/react-query";
import { hashKey } from "@tanstack/react-query";

import { collectionsKeys, copiesKeys } from "@/features/collections/lib/collections-query-keys";
import { decksKeys } from "@/features/decks/lib/decks-query-keys";
import { loansKeys } from "@/features/groups/lib/groups-query-keys";

const COALESCE_MS = 300;

/**
 * The deck list's missing and locked counts are computed server-side from copies,
 * collection settings and loans, so a change to any of those refetches the list.
 */
export function watchOwnershipForDeckList(queryClient: QueryClient, userId: string): () => void {
  const watchedKeys = [
    copiesKeys.syncedStore(userId),
    collectionsKeys.syncedStore(userId),
    loansKeys.all(userId),
  ];
  const seen = new Map<string, unknown>();
  for (const key of watchedKeys) {
    const data = queryClient.getQueryData(key);
    if (data !== undefined) {
      seen.set(hashKey(key), data);
    }
  }
  const watched = new Set(watchedKeys.map((key) => hashKey(key)));
  let pending: ReturnType<typeof setTimeout> | undefined;

  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    // query-db-collection's direct writes land as setState, refetches as success.
    if (
      event.type !== "updated" ||
      (event.action.type !== "success" && event.action.type !== "setState")
    ) {
      return;
    }
    const hash = event.query.queryHash;
    if (!watched.has(hash)) {
      return;
    }
    const data: unknown = event.query.state.data;
    const known = seen.has(hash);
    const previous = seen.get(hash);
    seen.set(hash, data);
    if (!known || previous === data) {
      return;
    }
    clearTimeout(pending);
    pending = setTimeout(() => {
      void queryClient.invalidateQueries({ queryKey: decksKeys.syncedStore(userId), exact: true });
    }, COALESCE_MS);
  });
  return () => {
    clearTimeout(pending);
    unsubscribe();
  };
}
