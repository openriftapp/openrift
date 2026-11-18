import type { MutationCache } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { reportMutationError } from "@/lib/query-client";

type QueryKey = readonly unknown[];

export function useOptimisticMutation<TCache, TVariables = void, TData = unknown>(options: {
  mutationKey?: QueryKey;
  queryKey: QueryKey | ((variables: TVariables) => QueryKey);
  mutationFn: (variables: TVariables) => Promise<TData>;
  apply: (cached: TCache, variables: TVariables) => TCache;
  /** Undoes `apply` on the cache as it is when the write fails; without it the whole snapshot returns. */
  rollback?: (cached: TCache, variables: TVariables, previous: TCache) => TCache;
  invalidates?: readonly QueryKey[] | ((variables: TVariables) => readonly QueryKey[]);
  /** Writes in flight to the same cache, this one included; only the last to settle refetches. */
  pendingWrites?: (mutationCache: MutationCache, variables: TVariables) => number;
}) {
  const queryClient = useQueryClient();
  const {
    mutationKey,
    queryKey,
    mutationFn,
    apply,
    rollback,
    invalidates = [],
    pendingWrites,
  } = options;
  const keyFor = (variables: TVariables) =>
    typeof queryKey === "function" ? queryKey(variables) : queryKey;
  return useMutation<TData, Error, TVariables, { previous: TCache | undefined }>({
    mutationKey,
    mutationFn,
    onMutate: async (variables) => {
      const key = keyFor(variables);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<TCache>(key);
      if (previous !== undefined) {
        queryClient.setQueryData<TCache>(key, apply(previous, variables));
      }
      return { previous };
    },
    onError: (error, variables, context) => {
      const previous = context?.previous;
      if (previous !== undefined) {
        const key = keyFor(variables);
        const cached = queryClient.getQueryData<TCache>(key);
        queryClient.setQueryData<TCache>(
          key,
          rollback === undefined || cached === undefined
            ? previous
            : rollback(cached, variables, previous),
        );
      }
      reportMutationError(error, queryClient);
    },
    onSettled: async (_data, _error, variables) => {
      // A refetch while another write to the cache is in flight would show the cache without it.
      if (
        pendingWrites !== undefined &&
        pendingWrites(queryClient.getMutationCache(), variables) > 1
      ) {
        return;
      }
      const extra = typeof invalidates === "function" ? invalidates(variables) : invalidates;
      // A rejected onSettled fails the mutation, so a failed refetch must not reject.
      await Promise.allSettled(
        [keyFor(variables), ...extra].map((key) =>
          queryClient.invalidateQueries({ queryKey: [...key] }),
        ),
      );
    },
  });
}
