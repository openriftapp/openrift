import { adminCatalogWorkspaceBulkContract } from "@openrift/shared/contracts/admin/catalog-workspace-bulk";
import { implement } from "@orpc/server";

import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import {
  discardSameDifference,
  findSameDifference,
} from "../services/workspace-same-difference.js";

const os = implement(adminCatalogWorkspaceBulkContract)
  .$context<ApiContext>()
  .use(requireAuthedUser);

export const adminCatalogWorkspaceBulkRouter = {
  workspaceSameDifference: os.workspaceSameDifference.handler(({ input, context }) =>
    findSameDifference(context.repos, { access: context.adminAccess, input }),
  ),

  workspaceDiscardSameDifference: os.workspaceDiscardSameDifference.handler(({ input, context }) =>
    discardSameDifference(context.transact, context.repos, {
      access: context.adminAccess,
      userId: context.userId,
      input,
      now: new Date(),
    }),
  ),
};
