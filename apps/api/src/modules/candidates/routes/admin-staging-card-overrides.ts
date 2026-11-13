import { adminStagingCardOverridesContract } from "@openrift/shared/contracts/admin/staging-card-overrides";
import { marketplaceSkuKey } from "@openrift/shared/marketplace-sku-key";
import { implement } from "@orpc/server";

import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { recordAdminEvents } from "../../system/services/record-admin-event.js";

const os = implement(adminStagingCardOverridesContract)
  .$context<ApiContext>()
  .use(requireAuthedUser);

/**
 * The DELETE reads its SKU key from detailed `query` input: compact mode
 * drops DELETE query params.
 */
export const adminStagingCardOverridesRouter = {
  create: os.create.handler(async ({ input, context }): Promise<void> => {
    const { marketplaceAdmin: mktAdmin, catalogMutations } = context.repos;
    const { marketplace, externalId, finish, language, cardId } = input;
    await mktAdmin.upsertStagingCardOverride({
      marketplace,
      externalId,
      finish,
      language,
      cardId,
    });
    await recordAdminEvents(context.repos, context.userId, async () => {
      const card = await catalogMutations.getCardById(cardId);
      return [
        {
          action: "marketplace-variant.assign-card",
          entityType: "marketplace-variant",
          entityId: marketplaceSkuKey(marketplace, externalId, finish, language),
          entityLabel: card?.name,
          cardSlug: card?.slug,
          newValues: { marketplace, externalId, finish, language, cardId },
        },
      ];
    });
  }),

  remove: os.remove.handler(async ({ input, context }): Promise<void> => {
    const { marketplaceAdmin: mktAdmin, catalogMutations } = context.repos;
    const { marketplace, externalId, finish, language } = input.query;
    const removed = await mktAdmin.deleteStagingCardOverride(
      marketplace,
      externalId,
      finish,
      language ?? null,
    );
    await recordAdminEvents(context.repos, context.userId, async () => {
      const card = removed ? await catalogMutations.getCardById(removed.cardId) : undefined;
      return [
        {
          action: "marketplace-variant.unassign-card",
          entityType: "marketplace-variant",
          entityId: marketplaceSkuKey(marketplace, externalId, finish, language ?? null),
          entityLabel: card?.name,
          cardSlug: card?.slug,
          oldValues: {
            marketplace,
            externalId,
            finish,
            language: language ?? null,
            cardId: removed?.cardId ?? null,
          },
        },
      ];
    });
  }),
};
