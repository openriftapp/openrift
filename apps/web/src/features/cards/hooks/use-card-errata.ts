import { adminCardMutationsContract } from "@openrift/shared/contracts/admin/card-mutations";
import type { UploadErrataResponse } from "@openrift/shared/contracts/admin/card-mutations";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import type { ErrataInput } from "@/features/admin/lib/errata-draft";
import { catalogKeys, errataKeys } from "@/features/cards/lib/cards-query-keys";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { withCookies } from "@/lib/server-fns/middleware";
import type { ContractInput } from "@/lib/server-fns/orpc-client";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

type BulkErrataUploadBody = ContractInput<typeof adminCardMutationsContract, "uploadErrata">;

const upsertCardErrataFn = createServerFn({ method: "POST" })
  .validator(
    (input: {
      cardId: string;
      announcementId: string | null;
      correctedRulesText: string | null;
      correctedEffectText: string | null;
      source: string | null;
      sourceUrl?: string | null;
      effectiveDate?: string | null;
    }) => input,
  )
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminCardMutationsContract, context.cookie).upsertErrata({
      cardId: data.cardId,
      announcementId: data.announcementId,
      correctedRulesText: data.correctedRulesText,
      correctedEffectText: data.correctedEffectText,
      source: data.source,
      sourceUrl: data.sourceUrl ?? null,
      effectiveDate: data.effectiveDate ?? null,
    });
  });

export function useUpsertCardErrata() {
  return useMutationWithInvalidation({
    mutationFn: async (input: ErrataInput) => {
      await upsertCardErrataFn({ data: input });
    },
    invalidates: [adminKeys.cards.all, catalogKeys.all, errataKeys.all],
  });
}

const deleteCardErrataFn = createServerFn({ method: "POST" })
  .validator((input: { cardId: string }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminCardMutationsContract, context.cookie).deleteErrata({
      cardId: data.cardId,
    });
  });

export function useDeleteCardErrata() {
  return useMutationWithInvalidation({
    mutationFn: async ({ cardId }: { cardId: string }) => {
      await deleteCardErrataFn({ data: { cardId } });
    },
    invalidates: [adminKeys.cards.all, catalogKeys.all, errataKeys.all],
  });
}

export interface BulkErrataEntry {
  cardSlug: string;
  correctedRulesText?: string | null;
  correctedEffectText?: string | null;
  announcement?: { name: string; publishedOn: string; url: string } | null;
  source?: string | null;
  sourceUrl?: string | null;
  effectiveDate?: string | null;
}

const uploadErrataFn = createServerFn({ method: "POST" })
  .validator((input: BulkErrataUploadBody) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<UploadErrataResponse> =>
    apiOrpcClient(adminCardMutationsContract, context.cookie).uploadErrata(data),
  );

export function useUploadErrata() {
  return useMutationWithInvalidation({
    mutationFn: (payload: BulkErrataUploadBody) => uploadErrataFn({ data: payload }),
    invalidates: [adminKeys.cards.all, catalogKeys.all, errataKeys.all],
  });
}
