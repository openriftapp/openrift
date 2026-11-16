import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseMutationOptions } from "@tanstack/react-query";

type InvalidateKeys = readonly (readonly unknown[])[];

export function useMutationWithInvalidation<TData = unknown, TVariables = void>(
  options: Omit<UseMutationOptions<TData, Error, TVariables>, "onSuccess"> & {
    invalidates: InvalidateKeys | ((variables: TVariables, data: TData) => InvalidateKeys);
  },
) {
  const queryClient = useQueryClient();
  const { invalidates, ...rest } = options;

  return useMutation<TData, Error, TVariables>({
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
