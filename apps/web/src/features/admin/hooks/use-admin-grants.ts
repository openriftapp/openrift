import type { AdminSectionSlug } from "@openrift/shared/admin-sections";
import { adminGrantsContract } from "@openrift/shared/contracts/admin/grants";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminGrantsQueryOptions } from "@/features/admin/lib/admin-grants-queries";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";
import { useMutationWithInvalidation } from "@/lib/use-mutation-with-invalidation";

export function useAdminGrants() {
  return useSuspenseQuery(adminGrantsQueryOptions);
}

const addAdminGrantFn = createServerFn({ method: "POST" })
  .validator((input: { userId: string; section: AdminSectionSlug }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminGrantsContract, context.cookie).add({
      id: data.userId,
      section: data.section,
    });
  });

export function useAddAdminGrant() {
  return useMutationWithInvalidation({
    mutationFn: (vars: { userId: string; section: AdminSectionSlug }) =>
      addAdminGrantFn({ data: vars }),
    invalidates: [adminKeys.grants],
  });
}

const removeAdminGrantFn = createServerFn({ method: "POST" })
  .validator((input: { userId: string; section: AdminSectionSlug }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminGrantsContract, context.cookie).remove({
      id: data.userId,
      section: data.section,
    });
  });

export function useRemoveAdminGrant() {
  return useMutationWithInvalidation({
    mutationFn: (vars: { userId: string; section: AdminSectionSlug }) =>
      removeAdminGrantFn({ data: vars }),
    invalidates: [adminKeys.grants],
  });
}
