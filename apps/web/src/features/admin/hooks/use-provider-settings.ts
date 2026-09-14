import { adminProviderSettingsContract } from "@openrift/shared/contracts/admin/provider-settings";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { providerSettingsQueryOptions } from "@/features/admin/lib/provider-settings-queries";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";
import { useMutationWithInvalidation } from "@/lib/use-mutation-with-invalidation";

export function useProviderSettings() {
  return useSuspenseQuery(providerSettingsQueryOptions);
}

const reorderProviderSettingsFn = createServerFn({ method: "POST" })
  .validator((input: { providers: string[] }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminProviderSettingsContract, context.cookie).reorder({
      providers: data.providers,
    });
  });

export function useReorderProviderSettings() {
  return useMutationWithInvalidation({
    mutationFn: async (providers: string[]) => {
      await reorderProviderSettingsFn({ data: { providers } });
    },
    invalidates: [adminKeys.providerSettings, adminKeys.sources],
  });
}

const updateProviderSettingFn = createServerFn({ method: "POST" })
  .validator(
    (input: {
      provider: string;
      sortOrder?: number;
      isHidden?: boolean;
      isFavorite?: boolean;
      helperReviewable?: boolean;
    }) => input,
  )
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminProviderSettingsContract, context.cookie).update(data);
  });

export function useUpdateProviderSetting() {
  return useMutationWithInvalidation({
    mutationFn: async (vars: {
      provider: string;
      sortOrder?: number;
      isHidden?: boolean;
      isFavorite?: boolean;
      helperReviewable?: boolean;
    }) => {
      await updateProviderSettingFn({ data: vars });
    },
    invalidates: [adminKeys.providerSettings, adminKeys.cards.list, adminKeys.sources],
  });
}
