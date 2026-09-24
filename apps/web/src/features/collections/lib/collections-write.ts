import { collectionsContract } from "@openrift/shared/contracts/collections";
import type { CollectionResponse } from "@openrift/shared/types/api/collection";
import type { Collection, PendingMutation, Transaction } from "@tanstack/react-db";
import type { QueryClient } from "@tanstack/react-query";

import { startSyncIfNeeded } from "@/features/collections/lib/collection-cleanup";
import { getCopiesCollection } from "@/features/collections/lib/copies-collection";
import { restartInFlightCopiesRefetch } from "@/features/collections/lib/copies-in-flight-refetch";
import { writeSkippingMissing } from "@/features/collections/lib/copies-write";
import { browserApiOrpcClient } from "@/lib/server-fns/orpc-client";

export type CollectionsCollection = Collection<CollectionResponse, string | number>;

export interface CollectionsWriteContext {
  queryClient: QueryClient;
  userId: string;
}

const reorders = new WeakMap<object, readonly string[]>();

/** Rows missing from `orderedIds`, such as group collections, keep their place. */
export function reorderCollections(
  collection: CollectionsCollection,
  orderedIds: readonly string[],
): Transaction {
  const present = orderedIds.filter((id) => collection.has(id));
  const metadata = {};
  reorders.set(metadata, orderedIds);
  return collection.update(present, { metadata }, (drafts) => {
    for (const [index, draft] of drafts.entries()) {
      draft.sortOrder = index;
    }
  });
}

function reorderOf(mutation: PendingMutation<CollectionResponse>): readonly string[] | undefined {
  const { metadata } = mutation;
  return typeof metadata === "object" && metadata !== null ? reorders.get(metadata) : undefined;
}

async function persistCreate(row: CollectionResponse): Promise<void> {
  await browserApiOrpcClient(collectionsContract).create({
    id: row.id,
    name: row.name,
    description: row.description,
    availableForDeckbuilding: row.availableForDeckbuilding,
    ...(row.groupSlug === null ? {} : { groupSlug: row.groupSlug }),
    ...(row.purpose === null ? {} : { purpose: row.purpose }),
  });
}

async function persistUpdate(mutation: PendingMutation<CollectionResponse>): Promise<void> {
  const client = browserApiOrpcClient(collectionsContract);
  const id = String(mutation.key);
  const { name, description, availableForDeckbuilding, sidebarHidden, isPublic } = mutation.changes;

  if (name !== undefined || description !== undefined) {
    await client.update({ id, name, description });
  }
  if (availableForDeckbuilding !== undefined) {
    await client.setDeckbuilding({ id, available: availableForDeckbuilding });
  }
  if (sidebarHidden !== undefined) {
    await client.setSidebarHidden({ id, hidden: sidebarHidden });
  }
  if (isPublic === true) {
    await client.share({ id });
  } else if (isPublic === false) {
    await client.unshare({ id });
  }
}

async function persistDelete(
  collection: CollectionsCollection,
  id: string,
  context: CollectionsWriteContext,
): Promise<void> {
  await browserApiOrpcClient(collectionsContract).remove({ id });

  // The API moves a deleted collection's copies into the inbox, which is always personal.
  const inboxId = collection.toArray.find((row) => row.isInbox)?.id;
  const copies = getCopiesCollection(context.queryClient, context.userId);
  const moved = copies.toArray.filter((copy) => copy.collectionId === id);
  if (inboxId !== undefined && moved.length > 0) {
    startSyncIfNeeded(copies);
    writeSkippingMissing(
      moved.map((copy) => ({ id: copy.id, collectionId: inboxId, groupId: null })),
      (rows) => copies.utils.writeUpdate(rows),
    );
    restartInFlightCopiesRefetch(context.queryClient, context.userId);
  }
}

async function persistInOrder(
  collection: CollectionsCollection,
  mutations: readonly PendingMutation<CollectionResponse>[],
  context: CollectionsWriteContext,
): Promise<void> {
  const reorderGroups = new Set<readonly string[]>();
  for (const mutation of mutations) {
    const orderedIds = reorderOf(mutation);
    if (orderedIds) {
      reorderGroups.add(orderedIds);
      continue;
    }
    if (mutation.type === "insert") {
      await persistCreate(mutation.modified);
    } else if (mutation.type === "update") {
      await persistUpdate(mutation);
    } else {
      await persistDelete(collection, String(mutation.key), context);
    }
  }

  for (const orderedIds of reorderGroups) {
    await browserApiOrpcClient(collectionsContract).reorder({ orderedIds: [...orderedIds] });
  }
}

/** Sends a transaction's collection writes to the API; the adapter's refetch brings the confirmed rows back. */
export async function persistCollectionMutations(
  collection: CollectionsCollection,
  mutations: readonly PendingMutation<CollectionResponse>[],
  context: CollectionsWriteContext,
): Promise<void> {
  await persistInOrder(collection, mutations, context);
}
