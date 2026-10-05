import { isAdminSectionSlug } from "@openrift/shared/admin-sections";
import { adminGrantsContract } from "@openrift/shared/contracts/admin/grants";
import { implement } from "@orpc/server";

import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";

const os = implement(adminGrantsContract).$context<ApiContext>().use(requireAuthedUser);

// `list` filters out grants whose section slug isn't in the shared registry,
// matching what the requireAdmin gate authorizes.
export const adminGrantsRouter = {
  list: os.list.handler(async ({ context }) => {
    const rows = await context.repos.adminGrants.listAllWithUsers();
    return {
      grants: rows.flatMap((r) =>
        isAdminSectionSlug(r.section)
          ? [
              {
                userId: r.userId,
                userName: r.userName,
                userEmail: r.userEmail,
                section: r.section,
              },
            ]
          : [],
      ),
    };
  }),

  add: os.add.handler(async ({ context, input, errors }) => {
    if (!(await context.repos.users.existsById(input.id))) {
      throw errors.NOT_FOUND();
    }
    await context.repos.adminGrants.add(input.id, input.section);
  }),

  remove: os.remove.handler(async ({ context, input, errors }) => {
    const result = await context.repos.adminGrants.remove(input.id, input.section);
    if (result.numDeletedRows === 0n) {
      throw errors.NOT_FOUND();
    }
  }),
};
