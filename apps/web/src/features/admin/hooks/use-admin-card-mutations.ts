import type { DismissedValue } from "@openrift/shared/contracts/admin/card-detail-schemas";
import type {
  AcceptCardField,
  AcceptNewCardBody,
  AcceptPrintingBody,
  AcceptPrintingField,
  AcceptPrintingGroup,
  CreateCardBody,
  CreatePrintingBody,
  DismissedValueTarget,
  PatchCandidatePrintingBody,
} from "@openrift/shared/contracts/admin/card-mutations";
import { adminCardMutationsContract } from "@openrift/shared/contracts/admin/card-mutations";
import type { JobRunView } from "@openrift/shared/contracts/admin/job-runs";
import { adminJobRunsContract } from "@openrift/shared/contracts/admin/job-runs";
import { adminUnifiedMappingsContract } from "@openrift/shared/contracts/admin/unified-mappings";
import { JOB_KIND } from "@openrift/shared/job-run-kinds";
import type { Marketplace } from "@openrift/shared/types/pricing";
import { isDefinedError, safe } from "@orpc/client";
import type { MutationMeta } from "@tanstack/react-query";
import { queryOptions, useQueryClient } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useRef } from "react";

import { acceptEachNewCard, showAcceptOutcome } from "@/features/admin/lib/accept-outcome";
import { adminKeys, CANDIDATE_REVIEW_SCOPE } from "@/features/admin/lib/admin-query-keys";
import { checkMatchingResultFromRun, waitForJobRun } from "@/features/admin/lib/job-run-wait";
import { startJobFn } from "@/features/admin/lib/job-start";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const checkCandidateCardFn = createServerFn({ method: "POST" })
  .validator((input: { candidateCardId: string }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminCardMutationsContract, context.cookie).checkCandidateCard({
      candidateCardId: data.candidateCardId,
    });
  });

const uncheckCandidateCardFn = createServerFn({ method: "POST" })
  .validator((input: { candidateCardId: string }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminCardMutationsContract, context.cookie).uncheckCandidateCard({
      candidateCardId: data.candidateCardId,
    });
  });

const checkCandidateCardsFn = createServerFn({ method: "POST" })
  .validator((input: { cardId: string; candidateCardIds: string[] }) => input)
  .middleware([withCookies])
  .handler(({ context, data }) =>
    apiOrpcClient(adminCardMutationsContract, context.cookie).checkAllForCard(data),
  );

export const uncheckCandidateCardsFn = createServerFn({ method: "POST" })
  .validator((input: { candidateCardIds: string[] }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminCardMutationsContract, context.cookie).uncheckCandidateCards(data);
  });

const checkAllCandidateCardsFn = createServerFn({ method: "POST" })
  .validator((input: { cardId: string }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminCardMutationsContract, context.cookie).checkAllForCard({
      cardId: data.cardId,
    });
  });

const checkCandidatePrintingFn = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminCardMutationsContract, context.cookie).checkCandidatePrinting({
      id: data.id,
    });
  });

const uncheckCandidatePrintingFn = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminCardMutationsContract, context.cookie).uncheckCandidatePrinting({
      id: data.id,
    });
  });

export const uncheckCandidatePrintingsFn = createServerFn({ method: "POST" })
  .validator((input: { candidatePrintingIds: string[] }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminCardMutationsContract, context.cookie).uncheckCandidatePrintings(data);
  });

const dismissCandidateValueFn = createServerFn({ method: "POST" })
  .validator((input: DismissedValueTarget & { value: DismissedValue }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminCardMutationsContract, context.cookie).dismissCandidateValue(data);
  });

const listDismissedValuesFn = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }) =>
    apiOrpcClient(adminCardMutationsContract, context.cookie).listDismissedCandidateValues(),
  );

export const dismissedValuesQueryOptions = queryOptions({
  queryKey: adminKeys.dismissedValues,
  queryFn: () => listDismissedValuesFn(),
});

export const restoreCandidateValueFn = createServerFn({ method: "POST" })
  .validator((input: DismissedValueTarget) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminCardMutationsContract, context.cookie).restoreCandidateValue(data);
  });

const checkAllCandidatePrintingsFn = createServerFn({ method: "POST" })
  .validator((input: { printingId?: string; extraIds?: string[] }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminCardMutationsContract, context.cookie).checkAllCandidatePrintings({
      printingId: data.printingId,
      extraIds: data.extraIds,
    });
  });

const renameCardFn = createServerFn({ method: "POST" })
  .validator((input: { cardId: string; newId: string }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminCardMutationsContract, context.cookie).renameCard({
      cardId: data.cardId,
      newId: data.newId,
    });
  });

export const acceptCardFieldFn = createServerFn({ method: "POST" })
  .validator(
    (input: {
      cardId: string;
      field: AcceptCardField;
      value: unknown;
      source?: "provider" | "manual";
      expected?: unknown;
    }) => input,
  )
  .middleware([withCookies])
  .handler(({ context, data }) =>
    apiOrpcClient(adminCardMutationsContract, context.cookie).acceptField({
      cardId: data.cardId,
      field: data.field,
      value: data.value,
      source: data.source,
      expected: data.expected,
    }),
  );

export const acceptPrintingFieldFn = createServerFn({ method: "POST" })
  .validator(
    (input: {
      printingId: string;
      side?: 1 | 2;
      faceId?: string;
      field: AcceptPrintingField;
      value: unknown;
      source?: "provider" | "manual";
      expected?: unknown;
    }) => input,
  )
  .middleware([withCookies])
  .handler(({ context, data }) =>
    apiOrpcClient(adminCardMutationsContract, context.cookie).acceptPrintingField({
      printingId: data.printingId,
      side: data.side,
      faceId: data.faceId,
      field: data.field,
      value: data.value,
      source: data.source,
      expected: data.expected,
    }),
  );

const acceptNewCardFn = createServerFn({ method: "POST" })
  .validator((input: { name: string; cardFields: AcceptNewCardBody["cardFields"] }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminCardMutationsContract, context.cookie).acceptNewCard({
      name: data.name,
      cardFields: data.cardFields,
    });
  });

const acceptFavoritesFn = createServerFn({ method: "POST" })
  .validator((input: { name: string }) => input)
  .middleware([withCookies])
  .handler(({ context, data }) =>
    apiOrpcClient(adminCardMutationsContract, context.cookie).acceptFavoriteNewCard({
      name: data.name,
    }),
  );

const linkCardFn = createServerFn({ method: "POST" })
  .validator((input: { name: string; cardId: string }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminCardMutationsContract, context.cookie).linkUnmatched({
      name: data.name,
      cardId: data.cardId,
    });
  });

const reassignCandidatePrintingFn = createServerFn({ method: "POST" })
  .validator((input: { id: string; fields: PatchCandidatePrintingBody }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminCardMutationsContract, context.cookie).patchCandidatePrinting({
      id: data.id,
      ...data.fields,
    });
  });

const deleteCandidatePrintingFn = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminCardMutationsContract, context.cookie).deleteCandidatePrinting({
      id: data.id,
    });
  });

const copyCandidatePrintingFn = createServerFn({ method: "POST" })
  .validator((input: { id: string; printingId: string }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminCardMutationsContract, context.cookie).copyCandidatePrinting({
      id: data.id,
      printingId: data.printingId,
    });
  });

export const linkCandidatePrintingsFn = createServerFn({ method: "POST" })
  .validator((input: { candidatePrintingIds: string[]; printingId: string | null }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminCardMutationsContract, context.cookie).linkCandidatePrintings({
      candidatePrintingIds: data.candidatePrintingIds,
      printingId: data.printingId,
    });
  });

const deletePrintingFn = createServerFn({ method: "POST" })
  .validator((input: { printingId: string }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminCardMutationsContract, context.cookie).deletePrinting({
      printingId: data.printingId,
    });
  });

const deleteCardFn = createServerFn({ method: "POST" })
  .validator((input: { cardId: string }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminCardMutationsContract, context.cookie).deleteCard({
      cardId: data.cardId,
    });
  });

const acceptPrintingGroupFn = createServerFn({ method: "POST" })
  .validator(
    (input: {
      cardId: string;
      printingFields: AcceptPrintingBody["printingFields"];
      candidatePrintingIds: string[];
      secondSideFaceId?: string;
    }) => input,
  )
  .middleware([withCookies])
  .handler(({ context, data }) =>
    apiOrpcClient(adminCardMutationsContract, context.cookie).acceptPrinting({
      cardId: data.cardId,
      printingFields: data.printingFields,
      candidatePrintingIds: data.candidatePrintingIds,
      secondSideFaceId: data.secondSideFaceId,
    }),
  );

const acceptPrintingGroupsFn = createServerFn({ method: "POST" })
  .validator((input: { cardId: string; groups: AcceptPrintingGroup[] }) => input)
  .middleware([withCookies])
  .handler(({ context, data }) =>
    apiOrpcClient(adminCardMutationsContract, context.cookie).acceptPrintings(data),
  );

const checkPassFn = createServerFn({ method: "POST" })
  .validator(
    (input: { cardId: string; candidateCardIds: string[]; candidatePrintingIds: string[] }) =>
      input,
  )
  .middleware([withCookies])
  .handler(({ context, data }) =>
    apiOrpcClient(adminCardMutationsContract, context.cookie).checkPass(data),
  );

const checkProviderFn = createServerFn({ method: "POST" })
  .validator((input: { provider: string }) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<{ cardsChecked: number; printingsChecked: number }> =>
    apiOrpcClient(adminCardMutationsContract, context.cookie).checkByProvider({
      provider: data.provider,
    }),
  );

const deleteProviderFn = createServerFn({ method: "POST" })
  .validator((input: { provider: string }) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<{ deleted: number; provider: string }> =>
    apiOrpcClient(adminCardMutationsContract, context.cookie).deleteByProvider({
      provider: data.provider,
    }),
  );

// Hooks operating on a candidate/printing/image ID don't know the owning card
// slug; card-detail callers pass a narrower `invalidates` list.

type Scope = readonly (readonly unknown[])[];
const defaultScope: Scope = CANDIDATE_REVIEW_SCOPE;

export function useCheckCandidateCard(invalidates: Scope = defaultScope) {
  return useMutationWithInvalidation({
    mutationFn: async (candidateCardId: string, signal) => {
      await checkCandidateCardFn({ data: { candidateCardId }, signal });
    },
    invalidates,
  });
}

export function useDismissCandidateValue(invalidates: Scope = defaultScope) {
  return useMutationWithInvalidation({
    mutationFn: async (input: DismissedValueTarget & { value: DismissedValue }, signal) => {
      await dismissCandidateValueFn({ data: input, signal });
    },
    invalidates,
  });
}

export function useRestoreCandidateValue(invalidates: Scope = defaultScope) {
  return useMutationWithInvalidation({
    mutationFn: async (input: DismissedValueTarget, signal) => {
      await restoreCandidateValueFn({ data: input, signal });
    },
    invalidates,
  });
}

export function useUncheckCandidateCard(invalidates: Scope = defaultScope) {
  return useMutationWithInvalidation({
    mutationFn: async (candidateCardId: string, signal) => {
      await uncheckCandidateCardFn({ data: { candidateCardId }, signal });
    },
    invalidates,
  });
}

export function useCheckCandidateCards(invalidates: Scope = defaultScope) {
  return useMutationWithInvalidation({
    mutationFn: (input: { cardId: string; candidateCardIds: string[] }, signal) =>
      checkCandidateCardsFn({ data: input, signal }),
    invalidates,
  });
}

export function useCheckAllCandidateCards(invalidates: Scope = defaultScope) {
  return useMutationWithInvalidation({
    mutationFn: async (cardId: string, signal) => {
      await checkAllCandidateCardsFn({ data: { cardId }, signal });
    },
    invalidates,
  });
}

export function useCheckCandidatePrinting(invalidates: Scope = defaultScope) {
  return useMutationWithInvalidation({
    mutationFn: async (id: string, signal) => {
      await checkCandidatePrintingFn({ data: { id }, signal });
    },
    invalidates,
  });
}

export function useUncheckCandidatePrinting(invalidates: Scope = defaultScope) {
  return useMutationWithInvalidation({
    mutationFn: async (id: string, signal) => {
      await uncheckCandidatePrintingFn({ data: { id }, signal });
    },
    invalidates,
  });
}

export function useCheckAllCandidatePrintings(invalidates: Scope = defaultScope) {
  return useMutationWithInvalidation({
    mutationFn: async (
      { printingId, extraIds }: { printingId?: string; extraIds?: string[] },
      signal,
    ) => {
      await checkAllCandidatePrintingsFn({ data: { printingId, extraIds }, signal });
    },
    invalidates,
  });
}

export function useRenameCard() {
  return useMutationWithInvalidation({
    mutationFn: async ({ cardId, newId }: { cardId: string; newId: string }, signal) => {
      await renameCardFn({ data: { cardId, newId }, signal });
    },
    invalidates: ({ newId }) => [
      adminKeys.cards.detail(newId),
      adminKeys.cards.list,
      adminKeys.workspace,
      adminKeys.cards.allCards,
    ],
  });
}

/**
 * Leaves the page of a renamed or deleted card, then drops the detail cached under its old
 * address so Back refetches it. The drop waits for `leave`, so no mounted page refetches a 404.
 */
export function useLeaveCardPage(): (oldSlug: string, leave: () => Promise<void>) => Promise<void> {
  const queryClient = useQueryClient();
  return async (oldSlug, leave) => {
    await leave();
    queryClient.removeQueries({ queryKey: adminKeys.cards.detail(oldSlug), exact: true });
  };
}

export function useAcceptCardField(invalidates: Scope = defaultScope) {
  return useMutationWithInvalidation({
    mutationFn: (
      {
        cardId,
        field,
        value,
        source = "manual",
        expected,
      }: {
        cardId: string;
        field: AcceptCardField;
        value: unknown;
        source?: "provider" | "manual";
        expected?: unknown;
      },
      signal,
    ) => acceptCardFieldFn({ data: { cardId, field, value, source, expected }, signal }),
    invalidates,
  });
}

export function useAcceptPrintingField(invalidates: Scope = defaultScope) {
  return useMutationWithInvalidation({
    mutationFn: (
      {
        printingId,
        side = 1,
        faceId,
        field,
        value,
        source = "manual",
        expected,
      }: {
        printingId: string;
        side?: 1 | 2;
        faceId?: string;
        field: AcceptPrintingField;
        value: unknown;
        source?: "provider" | "manual";
        expected?: unknown;
      },
      signal,
    ) =>
      acceptPrintingFieldFn({
        data: { printingId, side, faceId, field, value, source, expected },
        signal,
      }),
    invalidates,
  });
}

export function useAcceptNewCard(meta?: MutationMeta) {
  return useMutationWithInvalidation({
    meta,
    mutationFn: async (
      {
        name,
        cardFields,
      }: {
        name: string;
        cardFields: AcceptNewCardBody["cardFields"];
      },
      signal,
    ) => {
      await acceptNewCardFn({ data: { name, cardFields }, signal });
    },
    invalidates: ({ name }) => [
      adminKeys.cards.unmatched(name),
      adminKeys.cards.list,
      adminKeys.workspace,
      adminKeys.cards.allCards,
    ],
  });
}

const createCardFn = createServerFn({ method: "POST" })
  .validator((input: { cardFields: CreateCardBody }) => input)
  .middleware([withCookies])
  .handler(({ context, data }) =>
    apiOrpcClient(adminCardMutationsContract, context.cookie).createCard(data.cardFields),
  );

export function useCreateCard() {
  return useMutationWithInvalidation({
    meta: { inlineError: true },
    mutationFn: (cardFields: CreateCardBody, signal) =>
      createCardFn({ data: { cardFields }, signal }),
    invalidates: (_variables, data) => [
      adminKeys.cards.detail(data.cardSlug),
      adminKeys.cards.list,
      adminKeys.workspace,
      adminKeys.cards.allCards,
    ],
  });
}

const createPrintingFn = createServerFn({ method: "POST" })
  .validator((input: { cardId: string; printingFields: CreatePrintingBody }) => input)
  .middleware([withCookies])
  .handler(({ context, data }) =>
    apiOrpcClient(adminCardMutationsContract, context.cookie).createPrinting({
      cardId: data.cardId,
      ...data.printingFields,
    }),
  );

export function useCreatePrinting() {
  return useMutationWithInvalidation({
    meta: { inlineError: true },
    mutationFn: (
      {
        cardId,
        printingFields,
      }: {
        cardId: string;
        cardSlug: string;
        printingFields: CreatePrintingBody;
      },
      signal,
    ) => createPrintingFn({ data: { cardId, printingFields }, signal }),
    invalidates: ({ cardSlug }) => [
      adminKeys.cards.detail(cardSlug),
      adminKeys.cards.list,
      adminKeys.workspace,
    ],
  });
}

export function useAcceptFavoriteNewCard() {
  return useMutationWithInvalidation({
    mutationFn: (name: string, signal) => acceptFavoritesFn({ data: { name }, signal }),
    invalidates: (name) => [
      adminKeys.cards.unmatched(name),
      adminKeys.cards.list,
      adminKeys.workspace,
      adminKeys.cards.allCards,
    ],
  });
}

export function useLinkCard() {
  return useMutationWithInvalidation({
    mutationFn: async (
      { name, cardId }: { name: string; cardId: string; cardSlug: string },
      signal,
    ) => {
      await linkCardFn({ data: { name, cardId }, signal });
    },
    invalidates: ({ name, cardSlug }) => [
      adminKeys.cards.detail(cardSlug),
      adminKeys.cards.unmatched(name),
      adminKeys.cards.list,
      adminKeys.workspace,
      adminKeys.cards.allCards,
    ],
  });
}

export function useReassignCandidatePrinting(invalidates: Scope = defaultScope) {
  return useMutationWithInvalidation({
    mutationFn: async (
      { id, fields }: { id: string; fields: PatchCandidatePrintingBody },
      signal,
    ) => {
      await reassignCandidatePrintingFn({ data: { id, fields }, signal });
    },
    invalidates,
  });
}

export function useDeleteCandidatePrinting(invalidates: Scope = defaultScope) {
  return useMutationWithInvalidation({
    mutationFn: async (id: string, signal) => {
      await deleteCandidatePrintingFn({ data: { id }, signal });
    },
    invalidates,
  });
}

export function useCopyCandidatePrinting(invalidates: Scope = defaultScope) {
  return useMutationWithInvalidation({
    mutationFn: async ({ id, printingId }: { id: string; printingId: string }, signal) => {
      await copyCandidatePrintingFn({ data: { id, printingId }, signal });
    },
    invalidates,
  });
}

export function useLinkCandidatePrintings(invalidates: Scope = defaultScope) {
  return useMutationWithInvalidation({
    mutationFn: async (
      payload: { candidatePrintingIds: string[]; printingId: string | null },
      signal,
    ) => {
      await linkCandidatePrintingsFn({ data: payload, signal });
    },
    invalidates,
  });
}

export function useDeletePrinting(invalidates: Scope = defaultScope) {
  return useMutationWithInvalidation({
    mutationFn: async (printingId: string, signal) => {
      await deletePrintingFn({ data: { printingId }, signal });
    },
    invalidates,
  });
}

export function useDeleteCard() {
  return useMutationWithInvalidation({
    mutationFn: async (cardId: string, signal) => {
      await deleteCardFn({ data: { cardId }, signal });
    },
    invalidates: [adminKeys.cards.list, adminKeys.workspace, adminKeys.cards.allCards],
  });
}

export function useAcceptPrintingGroup(invalidates: Scope = defaultScope, meta?: MutationMeta) {
  return useMutationWithInvalidation({
    meta,
    mutationFn: (
      {
        cardId,
        printingFields,
        candidatePrintingIds,
        secondSideFaceId,
      }: {
        cardId: string;
        printingFields: AcceptPrintingBody["printingFields"];
        candidatePrintingIds: string[];
        secondSideFaceId?: string;
      },
      signal,
    ) =>
      acceptPrintingGroupFn({
        data: { cardId, printingFields, candidatePrintingIds, secondSideFaceId },
        signal,
      }),
    invalidates,
  });
}

/** Creates every group or none in one request; the catalog refreshes once. */
export function useAcceptPrintingGroups(invalidates: Scope = defaultScope, meta?: MutationMeta) {
  return useMutationWithInvalidation({
    meta,
    mutationFn: (input: { cardId: string; groups: AcceptPrintingGroup[] }, signal) =>
      acceptPrintingGroupsFn({ data: input, signal }),
    invalidates,
  });
}

/** Checks a pass's card and printing sources in one transaction. */
export function useCheckPass(invalidates: Scope = defaultScope) {
  return useMutationWithInvalidation({
    mutationFn: (
      input: { cardId: string; candidateCardIds: string[]; candidatePrintingIds: string[] },
      signal,
    ) => checkPassFn({ data: input, signal }),
    invalidates,
  });
}

export function useCheckProvider() {
  return useMutationWithInvalidation({
    mutationFn: (provider: string, signal) => checkProviderFn({ data: { provider }, signal }),
    invalidates: [
      adminKeys.cards.all,
      adminKeys.sources,
      adminKeys.reviewQueue,
      adminKeys.workspace,
    ],
  });
}

const getJobRunFn = createServerFn({ method: "GET" })
  .validator((input: { runId: string }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }): Promise<JobRunView | null> => {
    const { data: found, error } = await safe(
      apiOrpcClient(adminJobRunsContract, context.cookie).get({ runId: data.runId }),
    );
    if (error) {
      if (isDefinedError(error) && error.code === "NOT_FOUND") {
        return null;
      }
      throw error;
    }
    return found.run;
  });

/**
 * Starts the check matching job and resolves with its counts once the run finishes, or `null`
 * when the component unmounted first.
 */
export function useCheckMatchingCandidates() {
  const polling = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    polling.current = controller;
    return () => controller.abort();
  }, []);
  return useMutationWithInvalidation({
    mutationFn: async () => {
      const started = await startJobFn({ data: { kind: JOB_KIND.checkMatching } });
      const run = await waitForJobRun(
        () => getJobRunFn({ data: { runId: started.runId } }),
        undefined,
        undefined,
        polling.current?.signal,
      );
      return checkMatchingResultFromRun(run);
    },
    invalidates: [
      adminKeys.cards.all,
      adminKeys.sources,
      adminKeys.jobRuns,
      adminKeys.reviewQueue,
      adminKeys.workspace,
    ],
  });
}

const relinkCandidatePrintingsFn = createServerFn({ method: "POST" })
  .middleware([withCookies])
  .handler(({ context }): Promise<{ examined: number; linked: number }> =>
    apiOrpcClient(adminCardMutationsContract, context.cookie).relinkCandidatePrintings(),
  );

/** Links unlinked candidate printings accepted after their provider's last upload. */
export function useRelinkCandidatePrintings() {
  return useMutationWithInvalidation({
    mutationFn: () => relinkCandidatePrintingsFn(),
    invalidates: [
      adminKeys.cards.all,
      adminKeys.sources,
      adminKeys.reviewQueue,
      adminKeys.workspace,
    ],
  });
}

const acceptFavoritePrintingsFn = createServerFn({ method: "POST" })
  .validator((input: string) => input)
  .middleware([withCookies])
  .handler(
    ({
      context,
      data: cardSlug,
    }): Promise<{
      printingsCreated: number;
      skipped: { shortCode: string; reason: string }[];
    }> =>
      apiOrpcClient(adminCardMutationsContract, context.cookie).acceptFavoritePrintings({
        cardSlug,
      }),
  );

export function useAcceptFavoritePrintings() {
  return useMutationWithInvalidation({
    mutationFn: (cardSlug: string, signal) => acceptFavoritePrintingsFn({ data: cardSlug, signal }),
    invalidates: (cardSlug) => [
      adminKeys.cards.detail(cardSlug),
      adminKeys.cards.list,
      adminKeys.workspace,
    ],
  });
}

export function useDeleteProvider() {
  return useMutationWithInvalidation({
    mutationFn: (provider: string, signal) => deleteProviderFn({ data: { provider }, signal }),
    invalidates: [
      adminKeys.cards.all,
      adminKeys.sources,
      adminKeys.reviewQueue,
      adminKeys.workspace,
    ],
  });
}

export const unmapMarketplacePrintingFn = createServerFn({ method: "POST" })
  .validator(
    (input: {
      marketplace: Marketplace;
      printingId: string;
      externalId: number;
      finish: string;
      language: string | null;
    }) => input,
  )
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminUnifiedMappingsContract, context.cookie).unmap({
      query: {
        marketplace: data.marketplace,
        printingId: data.printingId,
        externalId: data.externalId,
        finish: data.finish,
        ...(data.language === null ? {} : { language: data.language }),
      },
    });
  });

const defaultMarketplaceScope: Scope = [adminKeys.cards.all, adminKeys.unifiedMappings.all];

export function useUnmapMarketplacePrinting(invalidates: Scope = defaultMarketplaceScope) {
  return useMutationWithInvalidation({
    mutationFn: (
      input: {
        marketplace: Marketplace;
        printingId: string;
        externalId: number;
        finish: string;
        language: string | null;
      },
      signal,
    ) => unmapMarketplacePrintingFn({ data: input, signal }),
    invalidates,
  });
}

export function useAcceptAllCards(
  onProgress: (progress: { done: number; total: number } | null) => void,
) {
  return useMutationWithInvalidation({
    mutationFn: async (names: string[], signal) => {
      onProgress({ done: 0, total: names.length });
      const outcome = await acceptEachNewCard(
        names,
        (name) => acceptFavoritesFn({ data: { name }, signal }),
        (done) => onProgress({ done, total: names.length }),
      );
      onProgress(null);
      showAcceptOutcome(outcome.accepted, outcome.skipped, { noun: "new card" });
      return outcome;
    },
    invalidates: CANDIDATE_REVIEW_SCOPE,
  });
}
