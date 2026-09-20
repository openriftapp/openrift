import type { DeckFolderResponse } from "@openrift/shared/types/api/deck";
import { useLiveQuery } from "@tanstack/react-db";
import type { QueryClient } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { v7 as uuidv7 } from "uuid";

import { useDeckFoldersCollection } from "@/features/decks/hooks/use-decks-collections";
import {
  getDeckFoldersCollection,
  getDecksCollection,
} from "@/features/decks/lib/decks-collection";
import { reorderDeckFolders } from "@/features/decks/lib/decks-write";
import { useRequiredUserId } from "@/lib/auth-session";

function byFolderOrder(a: DeckFolderResponse, b: DeckFolderResponse): number {
  return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
}

/** `/decks` also serves signed-out visitors; with no session there are no folders. */
export function useDeckFolders(): { data: DeckFolderResponse[] | undefined } {
  const collection = useDeckFoldersCollection();
  // No store to read during SSR.
  const { data, isReady } = useLiveQuery({
    query: (q) =>
      globalThis.window === undefined || !collection ? null : q.from({ folder: collection }),
  });
  if (!collection || !isReady) {
    return { data: undefined };
  }
  return { data: (data ?? []).toSorted(byFolderOrder) };
}

async function loadedFolders(queryClient: QueryClient, userId: string) {
  const collection = getDeckFoldersCollection(queryClient, userId);
  await collection.preload();
  return collection;
}

export function useCreateDeckFolder() {
  const userId = useRequiredUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name }: { name: string }): Promise<DeckFolderResponse> => {
      const collection = await loadedFolders(queryClient, userId);
      const now = new Date().toISOString();
      const row: DeckFolderResponse = {
        id: uuidv7(),
        name,
        sortOrder: Math.max(-1, ...collection.toArray.map((folder) => folder.sortOrder)) + 1,
        deckCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      await collection.insert(row).isPersisted.promise;
      return collection.get(row.id) ?? row;
    },
  });
}

export function useRenameDeckFolder() {
  const userId = useRequiredUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const collection = await loadedFolders(queryClient, userId);
      if (!collection.has(id)) {
        return;
      }
      await collection.update(id, (draft) => {
        draft.name = name;
      }).isPersisted.promise;
    },
  });
}

export function useRemoveDeckFolder() {
  const userId = useRequiredUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const collection = await loadedFolders(queryClient, userId);
      if (!collection.has(id)) {
        return;
      }
      await collection.delete(id).isPersisted.promise;
    },
  });
}

export function useReorderDeckFolders() {
  const userId = useRequiredUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderedIds }: { orderedIds: string[] }) => {
      const collection = await loadedFolders(queryClient, userId);
      await reorderDeckFolders(collection, orderedIds).isPersisted.promise;
    },
  });
}

/** Folder membership lives on the deck row, so the deck's write path sends it. */
export function useSetDeckFolders() {
  const userId = useRequiredUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, folderIds }: { id: string; folderIds: string[] }) => {
      const decks = getDecksCollection(queryClient, userId);
      await decks.preload();
      if (!decks.has(id)) {
        return;
      }
      await decks.update(id, (draft) => {
        draft.folderIds = folderIds;
      }).isPersisted.promise;
    },
  });
}
