import { adminIgnoredCandidatesContract } from "@openrift/shared/contracts/admin/ignored-candidates";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
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

const unignoreCandidateCardFn = createServerFn({ method: "POST" })
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

const unignoreCandidatePrintingFn = createServerFn({ method: "POST" })
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
