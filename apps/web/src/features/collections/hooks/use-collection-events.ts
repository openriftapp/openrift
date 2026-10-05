import { useSuspenseInfiniteQuery } from "@tanstack/react-query";

import { collectionEventsQueryOptions } from "@/features/collections/lib/collection-events-queries";
import { useRequiredUserId } from "@/hooks/use-session";

export function useCollectionEvents() {
  const userId = useRequiredUserId();
  return useSuspenseInfiniteQuery(collectionEventsQueryOptions(userId));
}
