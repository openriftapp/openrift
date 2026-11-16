import { useMutation, useQueryClient } from "@tanstack/react-query";

import { reportMutationError } from "@/lib/query-client";

type QueryKey = readonly unknown[];

export function useOptimisticMutation<TCache, TVariables = void, TData = unknown>(options: {
  queryKey: QueryKey | ((variables: TVariables) => QueryKey);
  mutationFn: (variables: TVariables) => Promise<TData>;
  apply: (cached: TCache, variables: TVariables) => TCache;
  invalidates?: readonly QueryKey[] | ((variables: TVariables) => readonly QueryKey[]);
}) {
  const queryClient = useQueryClient();
  const { queryKey, mutationFn, apply, invalidates = [] } = options;
  const keyFor = (variables: TVariables) =>
    typeof queryKey === "function" ? queryKey(variables) : queryKey;
  return useMutation<TData, Error, TVariables, { previous: TCache | undefined }>({
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
      if (context?.previous !== undefined) {
        queryClient.setQueryData(keyFor(variables), context.previous);
      }
      reportMutationError(error, queryClient);
    },
    onSettled: async (_data, _error, variables) => {
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
