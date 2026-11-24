import { adminCatalogWorkspaceContract } from "@openrift/shared/contracts/admin/catalog-workspace";
import { implement } from "@orpc/server";

import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { listUnassignedListings } from "../../marketplace/services/unassigned-listings.js";
import { listWorkspaceHistory } from "../services/workspace-history.js";
import {
  buildListingItems,
  buildReviewCards,
  buildWorkspaceQueue,
} from "../services/workspace-queue.js";
import { listWorkspaceRecords } from "../services/workspace-records.js";

const os = implement(adminCatalogWorkspaceContract).$context<ApiContext>().use(requireAuthedUser);

export const adminCatalogWorkspaceRouter = {
  workspaceQueue: os.workspaceQueue.handler(({ input, context }) =>
    buildWorkspaceQueue(context.repos, {
      access: context.adminAccess,
      userId: context.userId,
      owner: input.owner,
      loadListings: () => listUnassignedListings(context.repos),
    }),
  ),

  workspaceListings: os.workspaceListings.handler(async ({ context }) =>
    buildListingItems(await listUnassignedListings(context.repos)),
  ),

  reviewCards: os.reviewCards.handler(({ context }) =>
    buildReviewCards(context.repos, {
      access: context.adminAccess,
      userId: context.userId,
    }),
  ),

  workspaceCardImages: os.workspaceCardImages.handler(async ({ context }) => {
    const rows = await context.repos.workspaceRecords.cardImages();
    return {
      images: Object.fromEntries(
        rows.map((row) => [row.cardSlug, { url: row.imageUrl, cardType: row.cardType }]),
      ),
    };
  }),

  workspaceRecords: os.workspaceRecords.handler(({ input, context }) =>
    listWorkspaceRecords(context.repos, {
      access: context.adminAccess,
      userId: context.userId,
      input,
    }),
  ),

  workspaceHistory: os.workspaceHistory.handler(({ input, context }) =>
    listWorkspaceHistory(context.repos, {
      access: context.adminAccess,
      userId: context.userId,
      input,
    }),
  ),
};
