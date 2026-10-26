import { adminCatalogWorkspaceBatchContract } from "@openrift/shared/contracts/admin/catalog-workspace-batch";
import { implement } from "@orpc/server";

import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { createMarketplaceConfigs } from "../../marketplace/lib/marketplace-configs.js";
import { listUnassignedListings } from "../../marketplace/services/unassigned-listings.js";
import {
  acceptTrustedCards,
  acceptTrustedPrintings,
  assignSuggestedListings,
  previewSuggestedListings,
  previewTrustedCards,
  previewTrustedPrintings,
} from "../services/workspace-batch.js";

const os = implement(adminCatalogWorkspaceBatchContract)
  .$context<ApiContext>()
  .use(requireAuthedUser);

function mutationContext(context: ApiContext & { userId: string }) {
  return {
    access: context.adminAccess,
    userId: context.userId,
    transact: context.transact,
    io: context.io,
  };
}

export const adminCatalogWorkspaceBatchRouter = {
  workspaceTrustedCardsPreview: os.workspaceTrustedCardsPreview.handler(({ context }) =>
    previewTrustedCards(context.repos, context.adminAccess),
  ),

  workspaceAcceptTrustedCards: os.workspaceAcceptTrustedCards.handler(({ context }) =>
    acceptTrustedCards(context.repos, mutationContext(context)),
  ),

  workspaceTrustedPrintingsPreview: os.workspaceTrustedPrintingsPreview.handler(({ context }) =>
    previewTrustedPrintings(context.repos, context.adminAccess),
  ),

  workspaceAcceptTrustedPrintings: os.workspaceAcceptTrustedPrintings.handler(({ context }) =>
    acceptTrustedPrintings(context.repos, mutationContext(context)),
  ),

  workspaceSuggestedListingsPreview: os.workspaceSuggestedListingsPreview.handler(({ context }) =>
    previewSuggestedListings(context.adminAccess, () => listUnassignedListings(context.repos)),
  ),

  workspaceAssignSuggestedListings: os.workspaceAssignSuggestedListings.handler(
    ({ input, context }) =>
      assignSuggestedListings(
        {
          access: context.adminAccess,
          transact: context.transact,
          configs: createMarketplaceConfigs(context.repos),
          input,
        },
        () => listUnassignedListings(context.repos),
      ),
  ),
};
