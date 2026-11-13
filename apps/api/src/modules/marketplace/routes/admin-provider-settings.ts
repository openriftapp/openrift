import { adminProviderSettingsContract } from "@openrift/shared/contracts/admin/provider-settings";
import type { ProviderSettingResponse } from "@openrift/shared/types/api/admin";
import { implement } from "@orpc/server";

import { auditChange } from "../../../lib/audit-change.js";
import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { recordAdminEvent } from "../../system/services/record-admin-event.js";

const os = implement(adminProviderSettingsContract).$context<ApiContext>().use(requireAuthedUser);

/**
 * Admin provider-settings. Bad-request states are thrown as `AppError` and
 * mapped by the handler's {@link appErrorInterceptor}.
 */
export const adminProviderSettingsRouter = {
  list: os.list.handler(async ({ context }) => {
    const { providerSettings: repo } = context.repos;
    const rows = await repo.listAll();
    return {
      providerSettings: rows.map((r): ProviderSettingResponse => ({
        provider: r.provider,
        sortOrder: r.sortOrder,
        isHidden: r.isHidden,
        isFavorite: r.isFavorite,
        helperReviewable: r.helperReviewable,
      })),
    };
  }),

  reorder: os.reorder.handler(async ({ input, context, errors }): Promise<void> => {
    const { providerSettings: repo } = context.repos;
    const { providers } = input;

    const uniqueProviders = new Set(providers);
    if (uniqueProviders.size !== providers.length) {
      throw errors.BAD_REQUEST({ message: "Duplicate providers in reorder list" });
    }

    await repo.reorder(providers);
    await recordAdminEvent(context.repos, context.userId, {
      action: "provider-setting.reorder",
      entityType: "provider-setting",
      newValues: { providers },
    });
  }),

  update: os.update.handler(async ({ input, context }): Promise<void> => {
    const { providerSettings: repo } = context.repos;
    const { provider, ...body } = input;
    const settings = await repo.listAll();
    const before = settings.find((row) => row.provider === provider);
    await repo.upsert(provider, body);
    await recordAdminEvent(context.repos, context.userId, {
      action: "provider-setting.update",
      entityType: "provider-setting",
      entityId: provider,
      ...auditChange(before, body),
    });
  }),
};
