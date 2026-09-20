import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { hashKey } from "@tanstack/react-query";

export function watchForRefetchRace(queryClient: QueryClient, queryKey: QueryKey): () => void {
  const queryHash = hashKey(queryKey);
  let fetched = false;
  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== "updated" || event.query.queryHash !== queryHash) {
      return;
    }
    // A collection's own store writes reach the cache as manual successes.
    if (
      event.action.type === "fetch" ||
      (event.action.type === "success" && event.action.manual !== true)
    ) {
      fetched = true;
    }
  });
  return () => {
    unsubscribe();
    if (fetched || queryClient.isFetching({ queryKey, exact: true }) > 0) {
      void queryClient.refetchQueries({ queryKey, exact: true }, { cancelRefetch: true });
    }
  };
}
