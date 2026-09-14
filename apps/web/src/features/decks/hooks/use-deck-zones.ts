import { adminDeckZonesContract } from "@openrift/shared/contracts/admin/deck-zones";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { adminDeckZonesQueryOptions } from "@/features/decks/lib/deck-zones-queries";
import { initKeys } from "@/lib/query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";
import { useMutationWithInvalidation } from "@/lib/use-mutation-with-invalidation";

export function useDeckZones() {
  return useSuspenseQuery(adminDeckZonesQueryOptions);
}

const reorderDeckZonesFn = createServerFn({ method: "POST" })
  .validator((input: { slugs: string[] }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminDeckZonesContract, context.cookie).reorder({ slugs: data.slugs });
  });

export function useReorderDeckZones() {
  return useMutationWithInvalidation({
    mutationFn: (slugs: string[]) => reorderDeckZonesFn({ data: { slugs } }),
    invalidates: [adminKeys.deckZones, initKeys.all],
  });
}

const updateDeckZoneFn = createServerFn({ method: "POST" })
  .validator((input: { slug: string; label?: string }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminDeckZonesContract, context.cookie).update(data);
  });

export function useUpdateDeckZone() {
  return useMutationWithInvalidation({
    mutationFn: (vars: { slug: string; label?: string }) => updateDeckZoneFn({ data: vars }),
    invalidates: [adminKeys.deckZones, initKeys.all],
  });
}
