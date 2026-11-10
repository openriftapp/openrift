import { adminIgnoredCandidatesContract } from "@openrift/shared/contracts/admin/ignored-candidates";
import type { UnmatchedCardDetailResponse } from "@openrift/shared/types/api/admin";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { unmatchedCardDetailQueryOptions } from "@/features/admin/lib/admin-card-queries";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { ignorableSources } from "@/features/admin/lib/ignorable-sources";
import { ignoredCandidatesQueryOptions } from "@/features/admin/lib/ignored-candidates-queries";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

type Scope = readonly (readonly unknown[])[];

const IGNORE_INVALIDATES = [
  adminKeys.ignoredCandidates,
  adminKeys.cards.all,
  adminKeys.reviewQueue,
] as const;

export function useIgnoredCandidates() {
  return useSuspenseQuery(ignoredCandidatesQueryOptions);
}

const ignoreCandidateCardFn = createServerFn({ method: "POST" })
  .validator((input: { provider: string; externalId: string }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminIgnoredCandidatesContract, context.cookie).ignoreCard(data);
  });

export function useIgnoreCandidateCard(invalidates: Scope = []) {
  return useMutationWithInvalidation({
    mutationFn: (params: { provider: string; externalId: string }) =>
      ignoreCandidateCardFn({ data: params }),
    invalidates: [...IGNORE_INVALIDATES, ...invalidates],
  });
}

/** Ignores every provider source of each new-card draft, one at a time, and
 *  refreshes once. A draft with only contributor submissions stays. */
export function useIgnoreNewCardDrafts(invalidates: Scope = []) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      names: readonly string[],
    ): Promise<{ ignored: number; sources: { provider: string; externalId: string }[] }> => {
      const details = (await Promise.all(
        names.map((name) =>
          queryClient.query({ ...unmatchedCardDetailQueryOptions(name), staleTime: 0 }),
        ),
      )) as UnmatchedCardDetailResponse[];
      const drafts = details
        .map((detail) => ignorableSources(detail.sources))
        .filter((sources) => sources.length > 0);
      const sources = drafts
        .flat()
        .map((source) => ({ provider: source.provider, externalId: source.externalId }));
      for (const source of sources) {
        await ignoreCandidateCardFn({ data: source });
      }
      return { ignored: drafts.length, sources };
    },
    onSettled: () => {
      for (const key of [...IGNORE_INVALIDATES, ...invalidates]) {
        void queryClient.invalidateQueries({ queryKey: [...key] });
      }
    },
  });
}

export const unignoreCandidateCardFn = createServerFn({ method: "POST" })
  .validator((input: { provider: string; externalId: string }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminIgnoredCandidatesContract, context.cookie).unignoreCard(data);
  });

export function useUnignoreCandidateCard() {
  return useMutationWithInvalidation({
    mutationFn: (params: { provider: string; externalId: string }) =>
      unignoreCandidateCardFn({ data: params }),
    invalidates: IGNORE_INVALIDATES,
  });
}

const ignoreCandidatePrintingFn = createServerFn({ method: "POST" })
  .validator((input: { provider: string; externalId: string; finish?: string | null }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminIgnoredCandidatesContract, context.cookie).ignorePrinting(data);
  });

export function useIgnoreCandidatePrinting(invalidates: Scope = []) {
  return useMutationWithInvalidation({
    mutationFn: (params: { provider: string; externalId: string; finish?: string | null }) =>
      ignoreCandidatePrintingFn({ data: params }),
    invalidates: [...IGNORE_INVALIDATES, ...invalidates],
  });
}

export const unignoreCandidatePrintingFn = createServerFn({ method: "POST" })
  .validator((input: { provider: string; externalId: string; finish: string | null }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminIgnoredCandidatesContract, context.cookie).unignorePrinting(data);
  });

export function useUnignoreCandidatePrinting() {
  return useMutationWithInvalidation({
    mutationFn: (params: { provider: string; externalId: string; finish: string | null }) =>
      unignoreCandidatePrintingFn({ data: params }),
    invalidates: IGNORE_INVALIDATES,
  });
}

const deletePrintingLinkFn = createServerFn({ method: "POST" })
  .validator((input: { provider: string; externalId: string; finish: string }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminIgnoredCandidatesContract, context.cookie).deletePrintingLink(data);
  });

export function useDeletePrintingLink() {
  return useMutationWithInvalidation({
    mutationFn: (params: { provider: string; externalId: string; finish: string }) =>
      deletePrintingLinkFn({ data: params }),
    invalidates: IGNORE_INVALIDATES,
  });
}
