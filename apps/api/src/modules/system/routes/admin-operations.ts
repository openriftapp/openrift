import { adminOperationsContract } from "@openrift/shared/contracts/admin/operations";
import { JOB_KIND } from "@openrift/shared/job-run-kinds";
import { createLogger } from "@openrift/shared/logger";
import { implement } from "@orpc/server";

import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { recordAdminEvent } from "../services/record-admin-event.js";
import { runJobAsync } from "../services/run-job.js";

const log = createLogger("admin");

const os = implement(adminOperationsContract).$context<ApiContext>().use(requireAuthedUser);

/**
 * Admin operations. The refresh actions return a run handle (202) immediately
 * so Cloudflare doesn't 502 on long operations — callers poll job-runs. Any
 * thrown `AppError` is mapped by the handler's {@link appErrorInterceptor}.
 */
export const adminOperationsRouter = {
  clearPrices: os.clearPrices.handler(async ({ input, context }) => {
    const { marketplaceAdmin: mktAdmin } = context.repos;
    const { prices, variants, products } = await mktAdmin.clearPriceData(input.marketplace);
    await recordAdminEvent(context.repos, context.userId, {
      action: "marketplace.clear-prices",
      entityType: "marketplace",
      entityId: input.marketplace,
      newValues: { deleted: { prices, variants, products } },
    });
    return { marketplace: input.marketplace, deleted: { prices, variants, products } };
  }),
  refreshMatviews: os.refreshMatviews.handler(async ({ context }) => {
    const repos = context.backgroundRepos;
    return await runJobAsync({ repos, log }, JOB_KIND.refreshMatviews, "admin", async () => {
      await Promise.all([
        repos.marketplace.refreshLatestPrices(),
        repos.catalog.refreshCatalogViews(),
      ]);
    });
  }),

  siblingVariantDrift: os.siblingVariantDrift.handler(async ({ context }) => {
    const missing = await context.repos.marketplaceMapping.countMissingSiblingVariants();
    return { missing };
  }),

  backfillSiblingVariants: os.backfillSiblingVariants.handler(async ({ context }) => {
    const repos = context.backgroundRepos;
    return await runJobAsync(
      { repos, log },
      JOB_KIND.backfillSiblingVariants,
      "admin",
      () => repos.marketplaceMapping.backfillSiblingVariants(),
      { summarize: (result) => result },
    );
  }),

  recomputeCardTokens: os.recomputeCardTokens.handler(async ({ context }) => {
    const repos = context.backgroundRepos;
    return await runJobAsync(
      { repos, log },
      JOB_KIND.recomputeCardTokens,
      "admin",
      async () => {
        // Derive first: `mv_card_aggregates` reads `card_tokens`, so refreshing
        // the other way round would publish the previous derivation.
        const result = await repos.cardTokens.recomputeAll();
        await repos.catalog.refreshCardAggregates();
        return result;
      },
      { summarize: (result) => result },
    );
  }),
};
