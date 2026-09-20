import { collectionsContract } from "@openrift/shared/contracts/collections";
import type {
  CollectionResponse,
  ResetCollectionsResponse,
} from "@openrift/shared/types/api/collection";
import type { FriendGroupListResponse } from "@openrift/shared/types/api/friend-group";
import { isDefinedError, safe } from "@orpc/client";
import { count, useLiveQuery, useLiveSuspenseQuery } from "@tanstack/react-db";
import type { QueryClient } from "@tanstack/react-query";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { useSyncExternalStore } from "react";
import { v7 as uuidv7 } from "uuid";

import { useCollectionsCollection } from "@/features/collections/hooks/use-collections-collection";
import { useCopiesCollection } from "@/features/collections/hooks/use-copies-collection";
import { startSyncIfNeeded } from "@/features/collections/lib/collection-cleanup";
import { getCollectionsCollection } from "@/features/collections/lib/collections-collection";
import { compareCollections } from "@/features/collections/lib/collections-order";
import { publicCollectionQueryOptions } from "@/features/collections/lib/collections-query";
import { reorderCollections } from "@/features/collections/lib/collections-write";
import type { CopiesCollection } from "@/features/collections/lib/copies-write";
import { friendGroupsKeys } from "@/features/groups/lib/groups-query-keys";
import { useRequiredUserId } from "@/lib/auth-session";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

function withLiveCopyCounts(
  collections: readonly CollectionResponse[],
  counts?: readonly { collectionId: string; copies: number }[],
): CollectionResponse[] {
  const sorted = collections.toSorted(compareCollections);
  if (!counts) {
    return sorted;
  }
  const countById = new Map(counts.map((row) => [row.collectionId, row.copies]));
  return sorted.map((col) => ({ ...col, copyCount: countById.get(col.id) ?? 0 }));
}

// Subscribing to a store starts its sync; a page that only lists collections must not download every copy.
const unsubscribed = (): void => undefined;

function useCopiesSyncing(copies: CopiesCollection | null): boolean {
  return useSyncExternalStore(
    (onChange) => (copies ? copies.on("status:change", onChange) : unsubscribed),
    () => copies !== null && (copies.status === "loading" || copies.status === "ready"),
    () => false,
  );
}

/** Suspends until the viewer's collections are loaded. Copy counts turn live once the copies store is syncing. */
export function useCollections(): { data: CollectionResponse[] } {
  const userId = useRequiredUserId();
  const queryClient = useQueryClient();
  const collectionsCollection = getCollectionsCollection(queryClient, userId);
  const copiesCollection = useCopiesCollection();
  const copiesSyncing = useCopiesSyncing(copiesCollection);

  const { data: collections } = useLiveSuspenseQuery({
    query: (q) => q.from({ collection: collectionsCollection }),
  });
  const { data: counts, isReady } = useLiveQuery({
    query: (q) =>
      copiesSyncing && copiesCollection
        ? q
            .from({ copy: copiesCollection })
            .groupBy(({ copy }) => copy.collectionId)
            .select(({ copy }) => ({ collectionId: copy.collectionId, copies: count(copy.id) }))
        : null,
  });

  return { data: withLiveCopyCounts(collections, isReady ? counts : undefined) };
}

export function useCollectionsMap(): Map<string, CollectionResponse> {
  "use memo";
  const { data: collections } = useCollections();
  return new Map(collections.map((col) => [col.id, col]));
}

/** The viewer's collections, or undefined while they load or when nobody is signed in. */
export function useCollectionsList(): CollectionResponse[] | undefined {
  const collectionsCollection = useCollectionsCollection();
  // No store to read during SSR.
  const { data, isReady } = useLiveQuery({
    query: (q) =>
      globalThis.window === undefined || !collectionsCollection
        ? null
        : q.from({ collection: collectionsCollection }),
  });
  if (!collectionsCollection || !isReady) {
    return undefined;
  }
  return (data ?? []).toSorted(compareCollections);
}

async function loadedCollections(queryClient: QueryClient, userId: string) {
  const collection = getCollectionsCollection(queryClient, userId);
  await collection.preload();
  return collection;
}

interface CreateCollectionInput {
  name: string;
  description?: string | null;
  availableForDeckbuilding?: boolean;
  groupSlug?: string;
}

function optimisticCollection(
  queryClient: QueryClient,
  userId: string,
  existing: readonly CollectionResponse[],
  input: CreateCollectionInput,
): CollectionResponse {
  const isGroupCollection = input.groupSlug !== undefined;
  const group = isGroupCollection
    ? queryClient
        .getQueryData<FriendGroupListResponse>(friendGroupsKeys.all(userId))
        ?.items.find((item) => item.slug === input.groupSlug)
    : undefined;
  const personalSortOrders = existing
    .filter((row) => row.groupId === null)
    .map((row) => row.sortOrder);
  const now = new Date().toISOString();
  return {
    id: uuidv7(),
    name: input.name,
    description: input.description ?? null,
    availableForDeckbuilding: isGroupCollection ? false : (input.availableForDeckbuilding ?? true),
    sidebarHidden: false,
    isInbox: false,
    sortOrder: isGroupCollection ? 0 : Math.max(0, ...personalSortOrders) + 1,
    isPublic: false,
    shareToken: null,
    copyCount: 0,
    totalValueCents: null,
    unpricedCopyCount: null,
    createdAt: now,
    updatedAt: now,
    groupId: group?.id ?? null,
    groupSlug: input.groupSlug ?? null,
    groupName: group?.name ?? null,
    viewerCanAdmin: true,
    homeDecks: [],
  };
}

export function useCreateCollection() {
  const userId = useRequiredUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCollectionInput): Promise<CollectionResponse> => {
      const collection = await loadedCollections(queryClient, userId);
      const row = optimisticCollection(queryClient, userId, collection.toArray, input);
      await collection.insert(row).isPersisted.promise;
      return collection.get(row.id) ?? row;
    },
  });
}

export function useUpdateCollection() {
  const userId = useRequiredUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      name,
      description,
    }: {
      id: string;
      name?: string;
      description?: string | null;
    }) => {
      const collection = await loadedCollections(queryClient, userId);
      if (!collection.has(id)) {
        return;
      }
      await collection.update(id, (draft) => {
        if (name !== undefined) {
          draft.name = name;
        }
        if (description !== undefined) {
          draft.description = description;
        }
      }).isPersisted.promise;
    },
  });
}

/**
 * Sets the current viewer's own deck-building availability for a collection: a
 * per-member preference, so it's not gated on group-admin rights even for shared collections.
 */
export function useSetCollectionDeckbuilding() {
  const userId = useRequiredUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, available }: { id: string; available: boolean }) => {
      const collection = await loadedCollections(queryClient, userId);
      if (!collection.has(id)) {
        return;
      }
      await collection.update(id, (draft) => {
        draft.availableForDeckbuilding = available;
      }).isPersisted.promise;
    },
  });
}

/**
 * Moves a collection behind the sidebar's "Show more" toggle. Per-viewer like
 * deck-building availability, so a shared group member only curates their own sidebar.
 */
export function useSetCollectionSidebarHidden() {
  const userId = useRequiredUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, hidden }: { id: string; hidden: boolean }) => {
      const collection = await loadedCollections(queryClient, userId);
      if (!collection.has(id)) {
        return;
      }
      await collection.update(id, (draft) => {
        draft.sidebarHidden = hidden;
      }).isPersisted.promise;
    },
  });
}

/** Rows not in `orderedIds` (e.g. group-owned collections) stay where they are. */
export function useReorderCollections() {
  const userId = useRequiredUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderedIds }: { orderedIds: string[] }) => {
      const collection = await loadedCollections(queryClient, userId);
      await reorderCollections(collection, orderedIds).isPersisted.promise;
    },
  });
}

export function useShareCollection() {
  const userId = useRequiredUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (collectionId: string) => {
      const collection = await loadedCollections(queryClient, userId);
      if (!collection.has(collectionId)) {
        return;
      }
      await collection.update(collectionId, (draft) => {
        draft.isPublic = true;
      }).isPersisted.promise;
    },
  });
}

export function useUnshareCollection() {
  const userId = useRequiredUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (collectionId: string) => {
      const collection = await loadedCollections(queryClient, userId);
      if (!collection.has(collectionId)) {
        return;
      }
      await collection.update(collectionId, (draft) => {
        draft.isPublic = false;
        draft.shareToken = null;
      }).isPersisted.promise;
    },
  });
}

export function usePublicCollection(token: string) {
  return useSuspenseQuery(publicCollectionQueryOptions(token));
}

export function useDeleteCollection() {
  const userId = useRequiredUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const collection = await loadedCollections(queryClient, userId);
      if (collection.has(id)) {
        await collection.delete(id).isPersisted.promise;
      }
      return id;
    },
  });
}

// Exported for tests only — call through useResetCollections in app code.
export const resetCollectionsFn = createServerFn({ method: "POST" })
  .middleware([withCookies])
  .handler(async ({ context }): Promise<ResetCollectionsResponse> => {
    const { error, data } = await safe(
      apiOrpcClient(collectionsContract, context.cookie).resetAll(),
    );
    if (error) {
      // Rethrow the 409 CONFLICT plain so the dialog can show its user-readable message.
      if (isDefinedError(error) && error.code === "CONFLICT") {
        throw new Error(error.message);
      }
      throw error;
    }
    return data;
  });

/**
 * Danger-zone reset: wipes every copy from the user's personal collections, deletes
 * all personal collections except the inbox, and prunes lists it emptied. Group collections untouched.
 */
export function useResetCollections() {
  const queryClient = useQueryClient();
  const copiesCollection = useCopiesCollection();

  return useMutation({
    mutationFn: () => resetCollectionsFn(),
    onSuccess: () => {
      // Drop personal copies from the synced store immediately; group-owned copies survive.
      if (copiesCollection) {
        const personal = copiesCollection.toArray.filter((copy) => copy.groupId === null);
        if (personal.length > 0) {
          startSyncIfNeeded(copiesCollection);
          copiesCollection.utils.writeDelete(personal.map((copy) => copy.id));
        }
      }
      // Invalidates the whole cache: the wipe touches nearly every user-scoped surface.
      void queryClient.invalidateQueries();
    },
  });
}
