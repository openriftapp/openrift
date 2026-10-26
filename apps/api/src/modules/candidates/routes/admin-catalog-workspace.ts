import { adminCatalogWorkspaceContract } from "@openrift/shared/contracts/admin/catalog-workspace";
import { implement } from "@orpc/server";

import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { listUnassignedListings } from "../../marketplace/services/unassigned-listings.js";
import { listWorkspaceDecisions } from "../services/workspace-decisions.js";
import { listWorkspaceHistory } from "../services/workspace-history.js";
import { buildWorkspaceQueue } from "../services/workspace-queue.js";
import { listWorkspaceRecords } from "../services/workspace-records.js";
import { buildWorkspaceUploads } from "../services/workspace-uploads.js";

const os = implement(adminCatalogWorkspaceContract).$context<ApiContext>().use(requireAuthedUser);

export const adminCatalogWorkspaceRouter = {
  workspaceQueue: os.workspaceQueue.handler(({ input, context }) =>
    buildWorkspaceQueue(context.repos, {
      access: context.adminAccess,
      userId: context.userId,
      owner: input.owner,
      now: new Date(),
      loadListings: () => listUnassignedListings(context.repos),
    }),
  ),

  workspaceRecords: os.workspaceRecords.handler(({ input, context }) =>
    listWorkspaceRecords(context.repos, {
      access: context.adminAccess,
      userId: context.userId,
      input,
    }),
  ),

  workspaceUploads: os.workspaceUploads.handler(({ context }) =>
    buildWorkspaceUploads(context.repos, {
      access: context.adminAccess,
      userId: context.userId,
      now: new Date(),
    }),
  ),

  workspaceDecisions: os.workspaceDecisions.handler(({ input, context }) =>
    listWorkspaceDecisions(context.repos, { userId: context.userId, input, now: new Date() }),
  ),

  workspaceHistory: os.workspaceHistory.handler(({ input, context }) =>
    listWorkspaceHistory(context.repos, {
      access: context.adminAccess,
      userId: context.userId,
      input,
    }),
  ),
};
