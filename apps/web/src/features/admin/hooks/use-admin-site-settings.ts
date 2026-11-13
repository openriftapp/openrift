import { adminSiteSettingsContract } from "@openrift/shared/contracts/admin/site-settings";
import type { MutationMeta } from "@tanstack/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { adminSiteSettingsQueryOptions } from "@/features/admin/lib/admin-site-settings-queries";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { siteSettingsKeys } from "@/lib/query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

type SettingScope = "web" | "api";

export function useSiteSettings() {
  return useSuspenseQuery(adminSiteSettingsQueryOptions);
}

const updateSiteSettingFn = createServerFn({ method: "POST" })
  .validator((input: { key: string; value?: string; scope?: SettingScope }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminSiteSettingsContract, context.cookie).update(data);
  });

export function useUpdateSiteSetting(meta?: MutationMeta) {
  return useMutationWithInvalidation({
    meta,
    mutationFn: async (vars: { key: string; value?: string; scope?: SettingScope }) => {
      await updateSiteSettingFn({ data: vars });
    },
    invalidates: [adminKeys.siteSettings, siteSettingsKeys.all],
  });
}

const createSiteSettingFn = createServerFn({ method: "POST" })
  .validator((input: { key: string; value: string; scope?: SettingScope }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminSiteSettingsContract, context.cookie).create(data);
  });

export function useCreateSiteSetting(meta?: MutationMeta) {
  return useMutationWithInvalidation({
    meta,
    mutationFn: async (vars: { key: string; value: string; scope?: SettingScope }) => {
      await createSiteSettingFn({ data: vars });
    },
    invalidates: [adminKeys.siteSettings, siteSettingsKeys.all],
  });
}

const deleteSiteSettingFn = createServerFn({ method: "POST" })
  .validator((input: { key: string }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminSiteSettingsContract, context.cookie).remove({ key: data.key });
  });

export function useDeleteSiteSetting() {
  return useMutationWithInvalidation({
    mutationFn: async (key: string) => {
      await deleteSiteSettingFn({ data: { key } });
    },
    invalidates: [adminKeys.siteSettings, siteSettingsKeys.all],
  });
}
