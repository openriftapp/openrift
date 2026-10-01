import { adminUnifiedMappingsContract } from "@openrift/shared/contracts/admin/unified-mappings";
import { buildPriceAssignBucketsBySlug } from "@openrift/shared/price-assign-buckets";
import { implement } from "@orpc/server";

import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { createMarketplaceConfigs } from "../lib/marketplace-configs.js";
import { saveMappings, unmapPrinting } from "../services/marketplace-mapping.js";
import {
  buildUnifiedMappingsCardResponse,
  buildUnifiedMappingsResponse,
} from "../services/unified-mapping-merge.js";

const os = implement(adminUnifiedMappingsContract).$context<ApiContext>().use(requireAuthedUser);

export const adminUnifiedMappingsRouter = {
  list: os.list.handler(async ({ context }) => {
    const repos = context.repos;
    const { getMappingOverview } = context.services;
    return await buildUnifiedMappingsResponse(
      repos,
      createMarketplaceConfigs(repos),
      getMappingOverview,
    );
  }),

  summary: os.summary.handler(async ({ context }) => {
    const repos = context.repos;
    const { getMappingOverview } = context.services;
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
    const config = configs[input.query.marketplace];
    return await saveMappings(transact, config, input.body.mappings);
  }),

  unmap: os.unmap.handler(async ({ input, context }): Promise<void> => {
    const repos = context.repos;
    const transact = context.transact;
    const { marketplace, printingId, externalId, finish, language } = input.query;
    const configs = createMarketplaceConfigs(repos);
    const config = configs[marketplace];
    await unmapPrinting(transact, config, printingId, externalId, finish, language ?? null);
  }),
};
