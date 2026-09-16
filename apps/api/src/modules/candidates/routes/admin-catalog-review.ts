import { adminCatalogReviewContract } from "@openrift/shared/contracts/admin/catalog-review";
import { implement } from "@orpc/server";

import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { reviewableProviderScope } from "../services/card-review-scope.js";
import { buildCatalogSources } from "../services/catalog-sources.js";
import { buildReviewQueue } from "../services/review-queue.js";
import {
  acceptSubmission,
  createCardFromCandidate,
  rejectSubmission,
} from "../services/submission-review.js";

const os = implement(adminCatalogReviewContract).$context<ApiContext>().use(requireAuthedUser);

// Both accept verbs refuse a settled submission, so an accepted row here was pending before the call.
async function thankIfAccepted(context: ApiContext, candidateCardId: string): Promise<void> {
  const submission = await context.repos.cardSubmissions.findByCandidateCardId(candidateCardId);
  if (submission?.status === "accepted") {
    await context.services.notifySubmitterOfCardAcceptance(context.repos, submission.id);
  }
}

export const adminCatalogReviewRouter = {
  reviewQueue: os.reviewQueue.handler(async ({ context }) => {
    const { candidateCards, cardSubmissions, providerSettings } = context.repos;
    const scope = await reviewableProviderScope(context.adminAccess, providerSettings);
    return await buildReviewQueue({ candidateCards, cardSubmissions }, scope);
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
    const result = await acceptSubmission(context.transact, context.repos, context.io, {
      candidateCardId: input.candidateCardId,
      cardFields: input.cardFields,
      printingFields: input.printingFields,
      newPrintings: input.newPrintings,
      images: input.images,
      adminUserId: context.userId,
      scope,
      now: new Date(),
    });
    await thankIfAccepted(context, input.candidateCardId);
    return result;
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
    const result = await createCardFromCandidate(context.transact, context.repos, context.io, {
      candidateCardId: input.candidateCardId,
      cardFields: input.cardFields,
      printings: input.printings,
      images: input.images,
      adminUserId: context.userId,
      scope,
      now: new Date(),
    });
    await thankIfAccepted(context, input.candidateCardId);
    return result;
  }),
};
