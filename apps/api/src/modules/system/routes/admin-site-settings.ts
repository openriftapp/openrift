import { adminSiteSettingsContract } from "@openrift/shared/contracts/admin/site-settings";
import { implement } from "@orpc/server";

import { assertExisted, assertFound } from "../../../lib/assertions.js";
import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { toSiteSettingResponse } from "../lib/site-setting-presenters.js";

const os = implement(adminSiteSettingsContract).$context<ApiContext>().use(requireAuthedUser);

/**
 * Admin site-settings CRUD. Conflict / not-found states are thrown as
 * `AppError` and mapped by the handler's {@link appErrorInterceptor}.
 */
export const adminSiteSettingsRouter = {
  list: os.list.handler(async ({ context }) => {
    const { siteSettings } = context.repos;
    const rows = await siteSettings.listAll();
    return {
      settings: rows.map((row) => toSiteSettingResponse(row)),
    };
  }),

  create: os.create.handler(async ({ input, context, errors }): Promise<void> => {
    const { siteSettings } = context.repos;
    const { key, value, scope } = input;
    const created = await siteSettings.create({ key, value, scope: scope ?? "web" });
    if (!created) {
      throw errors.CONFLICT({ message: `Setting "${key}" already exists` });
    }
  }),

  update: os.update.handler(async ({ input, context }): Promise<void> => {
    const { siteSettings } = context.repos;
    const { key, ...body } = input;
    const updated = await siteSettings.update(key, body);
    assertFound(updated, `Setting "${key}" not found`);
  }),

  remove: os.remove.handler(async ({ input, context }): Promise<void> => {
    const { siteSettings } = context.repos;
    const deleted = await siteSettings.deleteByKey(input.key);
    assertExisted(deleted, `Setting "${input.key}" not found`);
  }),
};
