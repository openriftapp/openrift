import type { QueryClient } from "@tanstack/react-query";

import { collectionsQueryOptions } from "@/features/collections/lib/collections-query";
import { getCopiesCollection } from "@/features/collections/lib/copies-collection";
import { deckFoldersQueryOptions } from "@/features/decks/hooks/use-deck-folders";
import { decksQueryOptions } from "@/features/decks/lib/decks-queries";
import { friendGroupsQueryOptions } from "@/features/groups/lib/friend-groups-queries";
import { listsQueryOptions } from "@/features/lists/lib/lists-queries";

export function prefetchAreas(queryClient: QueryClient, userId: string): void {
  void Promise.allSettled([
    queryClient.query(decksQueryOptions(userId)),
    queryClient.query(deckFoldersQueryOptions(userId)),
    queryClient.query(collectionsQueryOptions(userId)),
    queryClient.query(listsQueryOptions(userId)),
    queryClient.query(listsQueryOptions(userId, "wish")),
    queryClient.query(friendGroupsQueryOptions(userId)),
    getCopiesCollection(queryClient, userId).preload(),
  ]);
}
