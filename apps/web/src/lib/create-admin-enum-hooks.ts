import type { DefaultError, UseSuspenseQueryOptions } from "@tanstack/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";

import { useMutationWithInvalidation } from "@/lib/use-mutation-with-invalidation";

type QueryKey = readonly unknown[];
type InvalidateKeys = readonly QueryKey[];

interface AdminEnumHooksConfig<
  TList,
  TQueryKey extends QueryKey,
  TCreateVars,
  TCreateResult,
  TUpdateVars,
  TUpdateResult,
  TReorderVars,
  TReorderResult,
  TDeleteVars,
  TDeleteResult,
> {
  listQueryOptions: UseSuspenseQueryOptions<TList, DefaultError, TList, TQueryKey>;
  invalidates: InvalidateKeys;
  create: (vars: TCreateVars) => Promise<TCreateResult>;
  update: (vars: TUpdateVars) => Promise<TUpdateResult>;
  reorder: (vars: TReorderVars) => Promise<TReorderResult>;
  reorderInvalidates?: InvalidateKeys;
  remove: (vars: TDeleteVars) => Promise<TDeleteResult>;
}

/**
 * `createServerFn` calls stay at module level in the calling file and are
 * passed in here as plain functions: the TanStack Start compiler assigns one
 * RPC id per syntactic call site, so a nested declaration would make every
 * enum share a single server function.
 */
export function createAdminEnumHooks<
  TList,
  TQueryKey extends QueryKey,
  TCreateVars,
  TCreateResult,
  TUpdateVars,
  TUpdateResult,
  TReorderVars,
  TReorderResult,
  TDeleteVars,
  TDeleteResult,
>(
  config: AdminEnumHooksConfig<
    TList,
    TQueryKey,
    TCreateVars,
    TCreateResult,
    TUpdateVars,
    TUpdateResult,
    TReorderVars,
    TReorderResult,
    TDeleteVars,
    TDeleteResult
  >,
) {
  const reorderInvalidates = config.reorderInvalidates ?? config.invalidates;

  function useList() {
    return useSuspenseQuery(config.listQueryOptions);
  }

  function useCreate() {
    return useMutationWithInvalidation<TCreateResult, TCreateVars>({
      mutationFn: config.create,
      invalidates: config.invalidates,
    });
  }

  function useUpdate() {
    return useMutationWithInvalidation<TUpdateResult, TUpdateVars>({
      mutationFn: config.update,
      invalidates: config.invalidates,
    });
  }

  function useReorder() {
    return useMutationWithInvalidation<TReorderResult, TReorderVars>({
      mutationFn: config.reorder,
      invalidates: reorderInvalidates,
    });
  }

  function useDelete() {
    return useMutationWithInvalidation<TDeleteResult, TDeleteVars>({
      mutationFn: config.remove,
      invalidates: config.invalidates,
    });
  }

  return { useList, useCreate, useUpdate, useReorder, useDelete };
}
