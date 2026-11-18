import { useQueryClient } from "@tanstack/react-query";
import type { UseMutationOptions } from "@tanstack/react-query";

import { useSignalledMutation } from "@/lib/write-signal";

type InvalidateKeys = readonly (readonly unknown[])[];

/** `mutationFn` gets the abort signal a caller passed to `mutate` or `mutateAsync`, if any. */
export function useMutationWithInvalidation<TData = unknown, TVariables = void>(
  options: Omit<UseMutationOptions<TData, Error, TVariables>, "onSuccess" | "mutationFn"> & {
    mutationFn: (variables: TVariables, signal?: AbortSignal) => Promise<TData>;
    invalidates: InvalidateKeys | ((variables: TVariables, data: TData) => InvalidateKeys);
  },
) {
  const queryClient = useQueryClient();
  const { invalidates, ...rest } = options;

  return useSignalledMutation<TData, TVariables>({
    ...rest,
    onSuccess: async (data, variables) => {
      const keys = typeof invalidates === "function" ? invalidates(variables, data) : invalidates;
      // A rejected onSuccess fails the mutation, so a failed refetch must not reject.
      await Promise.allSettled(
        keys.map((key) => queryClient.invalidateQueries({ queryKey: [...key] })),
      );
    },
  });
}
