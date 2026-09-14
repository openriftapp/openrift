import { adminDashboardContract } from "@openrift/shared/contracts/admin/dashboard";
import { implement } from "@orpc/server";

import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";

const os = implement(adminDashboardContract).$context<ApiContext>().use(requireAuthedUser);

export const adminDashboardRouter = {
  get: os.get.handler(async ({ context }) => {
    const { status } = context.repos;

    const [app, growth] = await Promise.all([status.getAppStats(), status.getGrowthSeries()]);

    return { app, growth };
  }),
};
