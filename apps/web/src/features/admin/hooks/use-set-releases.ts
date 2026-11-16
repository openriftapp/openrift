import { adminCatalogContract } from "@openrift/shared/contracts/admin/catalog";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { withCookies } from "@/lib/server-fns/middleware";
import type { ContractInput } from "@/lib/server-fns/orpc-client";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

type PutSetReleaseInput = ContractInput<typeof adminCatalogContract, "putSetRelease">;
type DeleteSetReleaseInput = ContractInput<typeof adminCatalogContract, "deleteSetRelease">;

const putSetReleaseFn = createServerFn({ method: "POST" })
  .validator((input: PutSetReleaseInput) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminCatalogContract, context.cookie).putSetRelease(data);
  });

const deleteSetReleaseFn = createServerFn({ method: "POST" })
  .validator((input: DeleteSetReleaseInput) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminCatalogContract, context.cookie).deleteSetRelease(data);
  });

export function usePutSetRelease(meta?: { inlineError: true }) {
  return useMutationWithInvalidation({
    meta,
    mutationFn: (input: PutSetReleaseInput) => putSetReleaseFn({ data: input }),
    invalidates: [adminKeys.sets],
  });
}

export function useDeleteSetRelease() {
  return useMutationWithInvalidation({
    mutationFn: (input: DeleteSetReleaseInput) => deleteSetReleaseFn({ data: input }),
    invalidates: [adminKeys.sets],
  });
}
