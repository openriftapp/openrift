import { adminFormatSetsContract } from "@openrift/shared/contracts/admin/format-sets";
import type { AdminFormatSetResponse } from "@openrift/shared/contracts/admin/format-sets";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { initKeys } from "@/lib/query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import type { ContractInput } from "@/lib/server-fns/orpc-client";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

type UpsertFormatSetInput = ContractInput<typeof adminFormatSetsContract, "upsert">;
type RemoveFormatSetInput = ContractInput<typeof adminFormatSetsContract, "remove">;

const listFormatSetsFn = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<{ formatSets: AdminFormatSetResponse[] }> =>
    apiOrpcClient(adminFormatSetsContract, context.cookie).list(),
  );

const upsertFormatSetFn = createServerFn({ method: "POST" })
  .validator((input: UpsertFormatSetInput) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminFormatSetsContract, context.cookie).upsert(data);
  });

const removeFormatSetFn = createServerFn({ method: "POST" })
  .validator((input: RemoveFormatSetInput) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminFormatSetsContract, context.cookie).remove(data);
  });

export function useFormatSets() {
  return useSuspenseQuery({
    queryKey: adminKeys.formatSets,
    queryFn: async () => {
      const { formatSets } = await listFormatSetsFn();
      return formatSets;
    },
  });
}

export function useUpsertFormatSet(meta?: { inlineError: true }) {
  return useMutationWithInvalidation({
    meta,
    mutationFn: (input: UpsertFormatSetInput) => upsertFormatSetFn({ data: input }),
    invalidates: [adminKeys.formatSets, initKeys.all],
  });
}

export function useRemoveFormatSet() {
  return useMutationWithInvalidation({
    mutationFn: (input: RemoveFormatSetInput) => removeFormatSetFn({ data: input }),
    invalidates: [adminKeys.formatSets, initKeys.all],
  });
}
