import { adminCatalogReviewContract } from "@openrift/shared/contracts/admin/catalog-review";
import type {
  AcceptSubmissionInput,
  AcceptSubmissionResponse,
  CreateCardFromCandidateInput,
  CreateCardFromCandidateResponse,
  RejectSubmissionInput,
  ReviewQueueResponse,
} from "@openrift/shared/contracts/admin/catalog-review";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { catalogAdminKeys } from "@/features/catalog-admin/lib/catalog-admin-query-keys";
import { cardSubmissionsKeys } from "@/features/contribute/lib/contribute-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";
import { useMutationWithInvalidation } from "@/lib/use-mutation-with-invalidation";

const fetchReviewQueue = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<ReviewQueueResponse> =>
    apiOrpcClient(adminCatalogReviewContract, context.cookie).reviewQueue(),
  );

export const reviewQueueQueryOptions = queryOptions({
  queryKey: catalogAdminKeys.reviewQueue,
  queryFn: () => fetchReviewQueue(),
  staleTime: 60 * 1000,
});

export function useReviewQueue() {
  return useQuery(reviewQueueQueryOptions);
}

export function useReviewQueueWhen(enabled: boolean) {
  return useQuery({ ...reviewQueueQueryOptions, enabled });
}

const acceptSubmissionFn = createServerFn({ method: "POST" })
  .validator((input: AcceptSubmissionInput) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<AcceptSubmissionResponse> =>
    apiOrpcClient(adminCatalogReviewContract, context.cookie).acceptSubmission(data),
  );

const rejectSubmissionFn = createServerFn({ method: "POST" })
  .validator((input: RejectSubmissionInput) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminCatalogReviewContract, context.cookie).rejectSubmission(data);
  });

const createCardFromCandidateFn = createServerFn({ method: "POST" })
  .validator((input: CreateCardFromCandidateInput) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<CreateCardFromCandidateResponse> =>
    apiOrpcClient(adminCatalogReviewContract, context.cookie).createCardFromCandidate(data),
  );

export interface SettleScope {
  cardSlug?: string;
  draftName?: string;
}

export function settleKeys(
  candidateCardId: string,
  scope: SettleScope = {},
): (readonly unknown[])[] {
  const keys: (readonly unknown[])[] = [
    catalogAdminKeys.reviewQueue,
    cardSubmissionsKeys.forCandidate(candidateCardId),
    adminKeys.cards.list,
  ];
  if (scope.cardSlug) {
    keys.push(adminKeys.cards.detail(scope.cardSlug));
  }
  if (scope.draftName) {
    keys.push(adminKeys.cards.unmatched(scope.draftName));
  }
  return keys;
}

export function useAcceptSubmission(scope: SettleScope = {}) {
  return useMutationWithInvalidation({
    mutationFn: (input: AcceptSubmissionInput) => acceptSubmissionFn({ data: input }),
    invalidates: (input) => settleKeys(input.candidateCardId, scope),
  });
}

export function useRejectSubmission(scope: SettleScope = {}) {
  return useMutationWithInvalidation({
    mutationFn: async (input: RejectSubmissionInput) => {
      await rejectSubmissionFn({ data: input });
    },
    invalidates: (input) => settleKeys(input.candidateCardId, scope),
  });
}

export function useCreateCardFromCandidate(scope: SettleScope = {}) {
  return useMutationWithInvalidation({
    mutationFn: (input: CreateCardFromCandidateInput) => createCardFromCandidateFn({ data: input }),
    invalidates: (input, data) => [
      ...settleKeys(input.candidateCardId, { ...scope, cardSlug: data.cardSlug }),
      adminKeys.cards.allCards,
    ],
  });
}
