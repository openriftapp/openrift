import { adminCatalogReviewContract } from "@openrift/shared/contracts/admin/catalog-review";
import { implement } from "@orpc/server";

import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { reviewableProviderScope } from "../services/card-review-scope.js";
import { buildCatalogCardList } from "../services/catalog-card-list.js";
import { buildCatalogSources } from "../services/catalog-sources.js";
import { buildReviewQueue } from "../services/review-queue.js";
import {
  acceptSubmission,
  createCardFromCandidate,
  rejectSubmission,
} from "../services/submission-review.js";

const os = implement(adminCatalogReviewContract).$context<ApiContext>().use(requireAuthedUser);

export const adminCatalogReviewRouter = {
  reviewQueue: os.reviewQueue.handler(async ({ context }) => {
    const { candidateCards, cardSubmissions, providerSettings } = context.repos;
    const scope = await reviewableProviderScope(context.adminAccess, providerSettings);
    return await buildReviewQueue({ candidateCards, cardSubmissions }, scope);
  }),

  catalogCards: os.catalogCards.handler(async ({ context }) => {
    const { candidateCards, providerSettings } = context.repos;
    const scope = await reviewableProviderScope(context.adminAccess, providerSettings);
    return await buildCatalogCardList({ candidateCards }, scope);
  }),

  catalogSources: os.catalogSources.handler(async ({ context }) => {
    const { candidateCards, cardSubmissions, providerSettings } = context.repos;
    const scope = await reviewableProviderScope(context.adminAccess, providerSettings);
    return await buildCatalogSources({ candidateCards, cardSubmissions }, scope);
  }),

  acceptSubmission: os.acceptSubmission.handler(async ({ input, context }) => {
    const scope = await reviewableProviderScope(
      context.adminAccess,
      context.repos.providerSettings,
    );
    return await acceptSubmission(context.transact, context.repos, context.io, {
      candidateCardId: input.candidateCardId,
      cardFields: input.cardFields,
      printingFields: input.printingFields,
      newPrintings: input.newPrintings,
      images: input.images,
      adminUserId: context.userId,
      scope,
      now: new Date(),
    });
  }),

  rejectSubmission: os.rejectSubmission.handler(async ({ input, context }): Promise<void> => {
    const scope = await reviewableProviderScope(
      context.adminAccess,
      context.repos.providerSettings,
    );
    await rejectSubmission(context.transact, context.repos, context.io, {
      candidateCardId: input.candidateCardId,
      reason: input.reason,
      note: input.note,
      adminUserId: context.userId,
      scope,
      now: new Date(),
    });
  }),

  createCardFromCandidate: os.createCardFromCandidate.handler(async ({ input, context }) => {
    const scope = await reviewableProviderScope(
      context.adminAccess,
      context.repos.providerSettings,
    );
    return await createCardFromCandidate(context.transact, context.repos, context.io, {
      candidateCardId: input.candidateCardId,
      cardFields: input.cardFields,
      printings: input.printings,
      images: input.images,
      adminUserId: context.userId,
      scope,
      now: new Date(),
    });
  }),
};
