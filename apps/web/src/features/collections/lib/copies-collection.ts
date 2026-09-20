// Collection identity is tied to (queryClient, userId): a user change evicts the previous
// entry and marks it orphaned. cleanup() is never called directly; TanStack DB's auto-GC
// fires it once subscriberCount hits 0.

import type { CollectionResponse, CopyResponse } from "@openrift/shared/types/api/collection";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import type { Collection } from "@tanstack/react-db";
import { BasicIndex, createCollection } from "@tanstack/react-db";
import type { QueryClient } from "@tanstack/react-query";

import { markOrphaned } from "@/features/collections/lib/collection-cleanup";
import { collectionsKeys, copiesKeys } from "@/features/collections/lib/collections-query-keys";
import { mergeCopiesDelta } from "@/features/collections/lib/copies-delta";
import { fetchCopies } from "@/features/collections/lib/copies-query";
import { persistCopyMutations } from "@/features/collections/lib/copies-write";

interface CacheEntry {
  userId: string;
  collection: Collection<CopyResponse, string | number>;
}

const cache = new WeakMap<QueryClient, CacheEntry>();

function accessibleCollectionIds(
  queryClient: QueryClient,
  userId: string,
): Set<string> | undefined {
  const rows = queryClient.getQueryData<CollectionResponse[]>(collectionsKeys.syncedStore(userId));
  return rows === undefined ? undefined : new Set(rows.map((row) => row.id));
}

export function getCopiesCollection(
  queryClient: QueryClient,
  userId: string,
): Collection<CopyResponse, string | number> {
  const existing = cache.get(queryClient);
  if (existing && existing.userId === userId) {
    return existing.collection;
  }
  if (existing) {
    markOrphaned(existing.collection, `copies:${existing.userId}`);
  }

  const context = { queryClient, userId };
  // Per collection instance, so a user switch starts from a full read.
  let syncedXid: string | undefined;
  let syncedCollectionIds: Set<string> | undefined;
  const collection = createCollection(
    queryCollectionOptions<CopyResponse>({
      id: `copies:${userId}`,
      queryClient,
      queryKey: [...copiesKeys.syncedStore(userId)],
      staleTime: 10 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      queryFn: async (ctx) => {
        const previous = queryClient.getQueryData<CopyResponse[]>([
          ...copiesKeys.syncedStore(userId),
        ]);
        const accessible = accessibleCollectionIds(queryClient, userId);
        const known = syncedCollectionIds;
        // A collection reachable only now (a group just joined) holds copies
        // stamped long before the watermark, which a delta would never return.
        const gainedAccess =
          known !== undefined &&
          accessible !== undefined &&
          [...accessible].some((id) => !known.has(id));
        // A delta is only safe once the reachable set of the previous read is known.
        const reachableUnknown = known === undefined && accessible !== undefined;

        const since =
          previous === undefined || gainedAccess || reachableUnknown ? undefined : syncedXid;
        const response = await fetchCopies(since, ctx.signal);
        syncedXid = response.syncedXid ?? syncedXid;
        syncedCollectionIds = accessible ?? known;

        const rows =
          since === undefined || response.deletedIds === undefined
            ? response.items
            : mergeCopiesDelta(previous ?? [], response.items, response.deletedIds);

        // Leaving a group writes no tombstone, so its copies go by access instead.
        const lost =
          known === undefined || accessible === undefined
            ? undefined
            : [...known].filter((id) => !accessible.has(id));
        if (lost === undefined || lost.length === 0) {
          return rows;
        }
        const dropped = new Set(lost);
        return rows.filter((row) => !dropped.has(row.collectionId));
      },
      getKey: (copy) => copy.id,
      onInsert: async ({ transaction, collection: copies }) => {
        await persistCopyMutations(copies, transaction.mutations, context);
        return { refetch: false };
      },
      onUpdate: async ({ transaction, collection: copies }) => {
        await persistCopyMutations(copies, transaction.mutations, context);
        return { refetch: false };
      },
      onDelete: async ({ transaction, collection: copies }) => {
        await persistCopyMutations(copies, transaction.mutations, context);
        return { refetch: false };
      },
    }),
  );
  collection.createIndex((row) => row.collectionId, { indexType: BasicIndex });
  collection.createIndex((row) => row.printingId, { indexType: BasicIndex });

  cache.set(queryClient, { userId, collection });
  return collection;
}
