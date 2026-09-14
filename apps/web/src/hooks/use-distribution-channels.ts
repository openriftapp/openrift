import { adminDistributionChannelsContract } from "@openrift/shared/contracts/admin/distribution-channels";
import type { DistributionChannelResponse } from "@openrift/shared/types/api/admin";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { promosKeys } from "@/features/cards/lib/cards-query-keys";
import { createAdminEnumHooks } from "@/lib/create-admin-enum-hooks";
import { adminDistributionChannelsQueryOptions } from "@/lib/distribution-channels-queries";
import { withCookies } from "@/lib/server-fns/middleware";
import type { ContractInput } from "@/lib/server-fns/orpc-client";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

type CreateChannelInput = ContractInput<typeof adminDistributionChannelsContract, "create">;
type UpdateChannelInput = ContractInput<typeof adminDistributionChannelsContract, "update">;

const createChannelFn = createServerFn({ method: "POST" })
  .validator((input: CreateChannelInput) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }): Promise<DistributionChannelResponse> => {
    const { distributionChannel } = await apiOrpcClient(
      adminDistributionChannelsContract,
      context.cookie,
    ).create(data);
    return distributionChannel;
  });

const updateChannelFn = createServerFn({ method: "POST" })
  .validator((input: UpdateChannelInput) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminDistributionChannelsContract, context.cookie).update(data);
  });

const reorderChannelsFn = createServerFn({ method: "POST" })
  .validator((input: { ids: string[] }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminDistributionChannelsContract, context.cookie).reorder({
      ids: data.ids,
    });
  });

const deleteChannelFn = createServerFn({ method: "POST" })
  .validator((input: { id: string; force?: boolean }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminDistributionChannelsContract, context.cookie).remove({
      params: { id: data.id },
      query: { force: data.force ? "true" : undefined },
    });
  });

const channelHooks = createAdminEnumHooks({
  listQueryOptions: adminDistributionChannelsQueryOptions,
  invalidates: [adminKeys.distributionChannels, promosKeys.all],
  create: (vars: CreateChannelInput) => createChannelFn({ data: vars }),
  update: (vars: UpdateChannelInput) => updateChannelFn({ data: vars }),
  reorder: (ids: string[]) => reorderChannelsFn({ data: { ids } }),
  remove: (vars: { id: string; force?: boolean }) => deleteChannelFn({ data: vars }),
});

export const useDistributionChannels = channelHooks.useList;
export const useCreateDistributionChannel = channelHooks.useCreate;
export const useUpdateDistributionChannel = channelHooks.useUpdate;
export const useDeleteDistributionChannel = channelHooks.useDelete;
export const useReorderDistributionChannels = channelHooks.useReorder;
