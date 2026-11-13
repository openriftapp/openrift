// Collection identity is tied to (queryClient, userId): a user change evicts the previous
// entry, which is cleaned up once its last reader detaches.

import { collectionsContract } from "@openrift/shared/contracts/collections";
import type { CollectionResponse } from "@openrift/shared/types/api/collection";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { createCollection } from "@tanstack/react-db";
import type { QueryClient } from "@tanstack/react-query";

import { cleanupWhenIdle, markOrphaned } from "@/features/collections/lib/collection-cleanup";
import { watchFailedLoad } from "@/features/collections/lib/collection-load-failure";
import { collectionsKeys } from "@/features/collections/lib/collections-query-keys";
import type { CollectionsCollection } from "@/features/collections/lib/collections-write";
import { persistCollectionMutations } from "@/features/collections/lib/collections-write";
import { browserApiOrpcClient } from "@/lib/server-fns/orpc-client";
import { m } from "@/paraglide/messages.js";

interface CacheEntry {
  userId: string;
  collection: CollectionsCollection;
}

const cache = new WeakMap<QueryClient, CacheEntry>();

export function getCollectionsCollection(
  queryClient: QueryClient,
  userId: string,
): CollectionsCollection {
  const existing = cache.get(queryClient);
  if (existing && existing.userId === userId) {
    return existing.collection;
  }
  if (existing) {
    markOrphaned(existing.collection, `collections:${existing.userId}`);
    cleanupWhenIdle(existing.collection);
  }

  const context = { queryClient, userId };
  const collection = createCollection(
    queryCollectionOptions<CollectionResponse>({
      id: `collections:${userId}`,
      queryClient,
      queryKey: [...collectionsKeys.syncedStore(userId)],
      staleTime: 10 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      queryFn: async (ctx) => {
        const response = await browserApiOrpcClient(collectionsContract).list(undefined, {
          signal: ctx.signal,
        });
        return response.items;
      },
      getKey: (row) => row.id,
      onInsert: async ({ transaction, collection: rows }) => {
        await persistCollectionMutations(rows, transaction.mutations, context);
        await rows.utils.refetch();
      },
      onUpdate: async ({ transaction, collection: rows }) => {
        await persistCollectionMutations(rows, transaction.mutations, context);
        await rows.utils.refetch();
      },
      onDelete: async ({ transaction, collection: rows }) => {
        await persistCollectionMutations(rows, transaction.mutations, context);
        await rows.utils.refetch();
      },
    }),
  );

  watchFailedLoad(collection, m.sync_load_failed_collections);
  cache.set(queryClient, { userId, collection });
  return collection;
}
