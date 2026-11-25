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
  mappingEvents,
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

  summary: os.summary.handler(async ({ input, context }) => {
    const repos = context.repos;
    const { groups, unmatchedProducts } = await buildUnifiedMappingsResponse(
      repos,
      createMarketplaceConfigs(repos),
      getMappingOverview,
    );
    const set = input?.set;
    const unmatched = Object.values(unmatchedProducts).flat();
    return {
      assignBucketsBySlug: buildPriceAssignBucketsBySlug(groups),
      unmatchedCount: set
        ? unmatched.filter((product) => product.groupSetSlug === set).length
        : unmatched.length,
      unattributedCount: unmatched.filter((product) => (product.groupSetSlug ?? null) === null)
        .length,
    };
  }),

  card: os.card.handler(async ({ input, context }) => {
    const repos = context.repos;
    return await buildUnifiedMappingsCardResponse(
      repos,
      createMarketplaceConfigs(repos),
      input.cardSlug,
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
    await recordAdminEvents(repos, context.userId, () =>
      mappingEvents(repos, marketplace, applied),
    );
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
