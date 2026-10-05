import { adminUsersContract } from "@openrift/shared/contracts/admin/users";
import { implement } from "@orpc/server";

import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { toAdminUser } from "../lib/user-presenters.js";

const os = implement(adminUsersContract).$context<ApiContext>().use(requireAuthedUser);

export const adminUsersRouter = {
  list: os.list.handler(async ({ context }) => {
    const { users: usersRepo } = context.repos;
    const rows = await usersRepo.listWithCounts();

    return {
      users: rows.map((row) => toAdminUser(row)),
    };
  }),
};
