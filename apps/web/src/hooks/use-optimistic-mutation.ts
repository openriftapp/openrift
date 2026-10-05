import { useMutation, useQueryClient } from "@tanstack/react-query";

import { reportMutationError } from "@/lib/query-client";

type QueryKey = readonly unknown[];

export function useOptimisticMutation<TCache, TVariables = void, TData = unknown>(options: {
  queryKey: QueryKey;
  mutationFn: (variables: TVariables) => Promise<TData>;
  apply: (cached: TCache, variables: TVariables) => TCache;
  invalidates?: readonly QueryKey[];
}) {
  const queryClient = useQueryClient();
  const { queryKey, mutationFn, apply, invalidates = [] } = options;
  return useMutation<TData, Error, TVariables, { previous: TCache | undefined }>({
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<TCache>(queryKey);
      if (previous !== undefined) {
        queryClient.setQueryData<TCache>(queryKey, apply(previous, variables));
      }
      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      reportMutationError(error, queryClient);
    },
    onSettled: () => {
      for (const key of [queryKey, ...invalidates]) {
        void queryClient.invalidateQueries({ queryKey: [...key] });
      }
    },
  });
}
