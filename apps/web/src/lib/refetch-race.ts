import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { hashKey } from "@tanstack/react-query";

/** Refetches `queryKey` after a write when a fetch for it ran during the write and may hold pre-write rows. */
export function watchForRefetchRace(
  queryClient: QueryClient,
  queryKey: QueryKey,
): (options?: { reread?: boolean }) => void {
  const queryHash = hashKey(queryKey);
  // A collection's own store writes reach the cache as data updates without a fetch.
  let fetched = queryClient.isFetching({ queryKey, exact: true }) > 0;
  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (
      event.type === "updated" &&
      event.query.queryHash === queryHash &&
      event.query.state.fetchStatus === "fetching"
    ) {
      fetched = true;
    }
  });
  return (options) => {
    unsubscribe();
    if (options?.reread || fetched) {
      void queryClient.refetchQueries({ queryKey, exact: true }, { cancelRefetch: true });
    }
  };
}
