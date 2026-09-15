import type { QueryClient } from "@tanstack/react-query";

import { copiesKeys } from "@/features/collections/lib/collections-query-keys";

// An in-flight copies fetch returns the list from before a confirmed write and would undo it on landing.
export function restartInFlightCopiesRefetch(queryClient: QueryClient, userId: string): void {
  const queryKey = copiesKeys.syncedStore(userId);
  if (queryClient.isFetching({ queryKey, exact: true }) > 0) {
    void queryClient.refetchQueries({ queryKey, exact: true }, { cancelRefetch: true });
  }
}
