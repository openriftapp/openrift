import type { QueryClient } from "@tanstack/react-query";

import { loadCollection } from "@/features/collections/lib/collection-load";
import { getCollectionsCollection } from "@/features/collections/lib/collections-collection";
import { getCopiesCollection } from "@/features/collections/lib/copies-collection";
import {
  getDeckCardsCollection,
  getDeckFoldersCollection,
  getDecksCollection,
} from "@/features/decks/lib/decks-collection";
import { friendGroupsQueryOptions } from "@/features/groups/lib/friend-groups-queries";
import { listsQueryOptions } from "@/features/lists/lib/lists-queries";

export function prefetchAreas(queryClient: QueryClient, userId: string): void {
  void Promise.allSettled([
    loadCollection(getDecksCollection(queryClient, userId)),
    loadCollection(getDeckCardsCollection(queryClient, userId)),
    loadCollection(getDeckFoldersCollection(queryClient, userId)),
    loadCollection(getCollectionsCollection(queryClient, userId)),
    queryClient.query(listsQueryOptions(userId)),
    queryClient.query(listsQueryOptions(userId, "wish")),
    queryClient.query(friendGroupsQueryOptions(userId)),
    loadCollection(getCopiesCollection(queryClient, userId)),
  ]);
}
