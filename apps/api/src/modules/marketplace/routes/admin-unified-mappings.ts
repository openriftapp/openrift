import { adminUnifiedMappingsContract } from "@openrift/shared/contracts/admin/unified-mappings";
import { marketplaceSkuKey } from "@openrift/shared/marketplace-sku-key";
import { buildPriceAssignBucketsBySlug } from "@openrift/shared/price-assign-buckets";
import { implement } from "@orpc/server";

import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { recordAdminEvents } from "../../system/services/record-admin-event.js";
import { createMarketplaceConfigs } from "../lib/marketplace-configs.js";
import {
  getMappingOverview,
  saveMappings,
  unmapPrinting,
} from "../services/marketplace-mapping.js";
import {
  buildUnifiedMappingsCardResponse,
  buildUnifiedMappingsResponse,
} from "../services/unified-mapping-merge.js";

const os = implement(adminUnifiedMappingsContract).$context<ApiContext>().use(requireAuthedUser);

export const adminUnifiedMappingsRouter = {
  list: os.list.handler(async ({ context }) => {
    const repos = context.repos;
    return await buildUnifiedMappingsResponse(
      repos,
      createMarketplaceConfigs(repos),
      getMappingOverview,
    );
  }),

  summary: os.summary.handler(async ({ context }) => {
    const repos = context.repos;
    const { groups, unmatchedProducts } = await buildUnifiedMappingsResponse(
      repos,
      createMarketplaceConfigs(repos),
      getMappingOverview,
    );
    return {
      assignBucketsBySlug: buildPriceAssignBucketsBySlug(groups),
      unmatchedCount: Object.values(unmatchedProducts).reduce(
        (sum, products) => sum + products.length,
        0,
      ),
    };
  }),

  card: os.card.handler(async ({ input, context }) => {
    const repos = context.repos;
    return await buildUnifiedMappingsCardResponse(
      repos,
      createMarketplaceConfigs(repos),
      input.cardId,
    );
  }),

  save: os.save.handler(async ({ input, context }) => {
    const repos = context.repos;
    const transact = context.transact;
    const configs = createMarketplaceConfigs(repos);
    const { marketplace } = input.query;
    const { saved, skipped, applied } = await saveMappings(
      transact,
      configs[marketplace],
      input.body.mappings,
    );
    await recordAdminEvents(repos, context.userId, async () => {
      const slugRows = await repos.marketplaceAdmin.cardSlugsForPrintings(
        applied.map((mapping) => mapping.printingId),
      );
      const slugs = new Map(slugRows.map((row) => [row.printingId, row.cardSlug]));
      return applied.map((mapping) => ({
        action: "marketplace-variant.map" as const,
        entityType: "marketplace-variant" as const,
        entityId: marketplaceSkuKey(
          marketplace,
          mapping.externalId,
          mapping.finish,
          mapping.language,
        ),
        cardSlug: slugs.get(mapping.printingId),
        newValues: { marketplace, ...mapping },
      }));
    });
    return { saved, skipped };
  }),

  unmap: os.unmap.handler(async ({ input, context }): Promise<void> => {
    const repos = context.repos;
    const transact = context.transact;
    const { marketplace, printingId, externalId, finish, language } = input.query;
    const configs = createMarketplaceConfigs(repos);
    const config = configs[marketplace];
    await unmapPrinting(transact, config, printingId, externalId, finish, language ?? null);
    await recordAdminEvents(repos, context.userId, async () => {
      const [slug] = await repos.marketplaceAdmin.cardSlugsForPrintings([printingId]);
      return [
        {
          action: "marketplace-variant.unmap",
          entityType: "marketplace-variant",
          entityId: marketplaceSkuKey(marketplace, externalId, finish, language ?? null),
          cardSlug: slug?.cardSlug,
          oldValues: { marketplace, printingId, externalId, finish, language: language ?? null },
        },
      ];
    });
  }),
};
