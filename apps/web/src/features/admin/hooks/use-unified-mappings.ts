import { adminIgnoredProductsContract } from "@openrift/shared/contracts/admin/ignored-products";
import { adminStagingCardOverridesContract } from "@openrift/shared/contracts/admin/staging-card-overrides";
import { adminUnifiedMappingsContract } from "@openrift/shared/contracts/admin/unified-mappings";
import type { UnifiedMappingsSummaryResponse } from "@openrift/shared/contracts/admin/unified-mappings";
import type { UnifiedMappingsCardResponse } from "@openrift/shared/types/api/admin";
import type { Marketplace } from "@openrift/shared/types/pricing";
import { keepPreviousData, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import {
  applyOptimisticAssignmentForCard,
  revertOptimisticAssignmentForCard,
} from "@/features/admin/lib/optimistic-card-assignment";
import {
  unifiedMappingsQueryOptions,
  unifiedMappingsSummaryQueryOptions,
} from "@/features/admin/lib/unified-mappings-queries";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { useOptimisticMutation } from "@/hooks/use-optimistic-mutation";
import { withCookies } from "@/lib/server-fns/middleware";
import type { ContractInput } from "@/lib/server-fns/orpc-client";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

export function useUnifiedMappings() {
  return useSuspenseQuery(unifiedMappingsQueryOptions());
}

function selectSummary(summary: UnifiedMappingsSummaryResponse) {
  return {
    assignBucketsBySlug: new Map(Object.entries(summary.assignBucketsBySlug)),
    unmatchedCount: summary.unmatchedCount,
    unattributedCount: summary.unattributedCount,
  };
}

/**
 * The marketplace endpoint 403s for card-review grant holders, so the query
 * only runs when `enabled` (full admin).
 */
export function useUnifiedMappingsSummaryWhen(enabled: boolean, set?: string) {
  return useQuery({
    ...unifiedMappingsSummaryQueryOptions(set),
    enabled,
    select: selectSummary,
    placeholderData: keepPreviousData,
  });
}

function useUnifiedMutation<TInput, TResult>(mutationFn: (input: TInput) => Promise<TResult>) {
  return useMutationWithInvalidation({
    mutationFn,
    invalidates: [adminKeys.unifiedMappings.all],
  });
}

type SaveMappingsBody = ContractInput<typeof adminUnifiedMappingsContract, "save">["body"];

type SaveMappingsResult = Awaited<
  ReturnType<ReturnType<typeof apiOrpcClient<typeof adminUnifiedMappingsContract>>["save"]>
>;

const saveMappingsFn = createServerFn({ method: "POST" })
  .validator((input: { marketplace: Marketplace } & SaveMappingsBody) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<SaveMappingsResult> =>
    apiOrpcClient(adminUnifiedMappingsContract, context.cookie).save({
      query: { marketplace: data.marketplace },
      body: { mappings: data.mappings },
    }),
  );

/** Saves the mappings and toasts each SKU the server skipped. */
async function saveUnifiedMappings(
  marketplace: Marketplace,
  mappings: SaveMappingsBody["mappings"],
): Promise<SaveMappingsResult> {
  const result = await saveMappingsFn({ data: { marketplace, mappings } });
  for (const skipped of result.skipped) {
    toast.error(`#${skipped.externalId}: ${skipped.reason}`);
  }
  return result;
}

export function useUnifiedSaveMappings(marketplace: Marketplace) {
  return useUnifiedMutation((body: SaveMappingsBody) =>
    saveUnifiedMappings(marketplace, body.mappings),
  );
}

const ignoreVariantsFn = createServerFn({ method: "POST" })
  .validator(
    (input: {
      marketplace: Marketplace;
      products: { externalId: number; finish: string; language: string | null }[];
    }) => input,
  )
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminIgnoredProductsContract, context.cookie).ignore({
      level: "variant",
      marketplace: data.marketplace,
      products: data.products,
    });
  });

const ignoreProductsFn = createServerFn({ method: "POST" })
  .validator((input: { marketplace: Marketplace; products: { externalId: number }[] }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminIgnoredProductsContract, context.cookie).ignore({
      level: "product",
      marketplace: data.marketplace,
      products: data.products,
    });
  });

/** Level-3 ignore: deny a specific SKU (finish × language) of an upstream product. */
export function useUnifiedIgnoreVariants(marketplace: Marketplace) {
  return useUnifiedMutation(
    async (products: { externalId: number; finish: string; language: string | null }[]) => {
      await ignoreVariantsFn({ data: { marketplace, products } });
    },
  );
}

/** Level-2 ignore: deny an entire upstream product regardless of finish/language. */
export function useUnifiedIgnoreProducts(marketplace: Marketplace) {
  return useUnifiedMutation(async (products: { externalId: number }[]) => {
    await ignoreProductsFn({ data: { marketplace, products } });
  });
}

const assignToCardFn = createServerFn({ method: "POST" })
  .validator(
    (input: {
      marketplace: Marketplace;
      externalId: number;
      finish: string;
      language: string | null;
      cardId: string;
    }) => input,
  )
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminStagingCardOverridesContract, context.cookie).create(data);
  });

export function useUnifiedAssignToCard(marketplace: Marketplace) {
  return useUnifiedMutation(
    async (override: {
      externalId: number;
      finish: string;
      language: string | null;
      cardId: string;
    }) => {
      await assignToCardFn({ data: { marketplace, ...override } });
    },
  );
}

const unassignFromCardFn = createServerFn({ method: "POST" })
  .validator(
    (input: {
      marketplace: Marketplace;
      externalId: number;
      finish: string;
      language: string | null;
    }) => input,
  )
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminStagingCardOverridesContract, context.cookie).remove({
      query: {
        marketplace: data.marketplace,
        externalId: data.externalId,
        finish: data.finish,
        ...(data.language === null ? {} : { language: data.language }),
      },
    });
  });

export function useUnifiedUnassignFromCard(marketplace: Marketplace) {
  return useUnifiedMutation(
    async (params: { externalId: number; finish: string; language: string | null }) => {
      await unassignFromCardFn({ data: { marketplace, ...params } });
    },
  );
}

export function useSaveMappingsByMarketplace() {
  return {
    tcgplayer: useUnifiedSaveMappings("tcgplayer"),
    cardmarket: useUnifiedSaveMappings("cardmarket"),
    cardtrader: useUnifiedSaveMappings("cardtrader"),
    cardnexus: useUnifiedSaveMappings("cardnexus"),
  } satisfies Record<Marketplace, unknown>;
}

type CardAssignment = SaveMappingsBody["mappings"][number];

function optimisticSave(cardSlug: string, marketplace: Marketplace) {
  return {
    queryKey: adminKeys.unifiedMappings.byCard(cardSlug),
    mutationFn: (mappings: CardAssignment[]) => saveUnifiedMappings(marketplace, mappings),
    apply: (cached: UnifiedMappingsCardResponse, mappings: CardAssignment[]) =>
      mappings.reduce(
        (next, m) =>
          applyOptimisticAssignmentForCard(
            next,
            marketplace,
            m.externalId,
            m.finish,
            m.language,
            m.printingId,
          ),
        cached,
      ),
    rollback: (
      cached: UnifiedMappingsCardResponse,
      mappings: CardAssignment[],
      previous: UnifiedMappingsCardResponse,
    ) =>
      mappings.reduce(
        (next, m) =>
          revertOptimisticAssignmentForCard(
            next,
            previous,
            marketplace,
            m.externalId,
            m.finish,
            m.language,
            m.printingId,
          ),
        cached,
      ),
    invalidates: [adminKeys.cards.detail(cardSlug), adminKeys.unifiedMappings.all],
  };
}

/** Saves on one card's page show the assignment at once and roll it back on failure. */
export function useOptimisticSaveMappingsByMarketplace(cardSlug: string) {
  return {
    tcgplayer: useOptimisticMutation(optimisticSave(cardSlug, "tcgplayer")),
    cardmarket: useOptimisticMutation(optimisticSave(cardSlug, "cardmarket")),
    cardtrader: useOptimisticMutation(optimisticSave(cardSlug, "cardtrader")),
    cardnexus: useOptimisticMutation(optimisticSave(cardSlug, "cardnexus")),
  } satisfies Record<Marketplace, unknown>;
}

export function useIgnoreVariantsByMarketplace() {
  return {
    tcgplayer: useUnifiedIgnoreVariants("tcgplayer"),
    cardmarket: useUnifiedIgnoreVariants("cardmarket"),
    cardtrader: useUnifiedIgnoreVariants("cardtrader"),
    cardnexus: useUnifiedIgnoreVariants("cardnexus"),
  } satisfies Record<Marketplace, unknown>;
}

export function useIgnoreProductsByMarketplace() {
  return {
    tcgplayer: useUnifiedIgnoreProducts("tcgplayer"),
    cardmarket: useUnifiedIgnoreProducts("cardmarket"),
    cardtrader: useUnifiedIgnoreProducts("cardtrader"),
    cardnexus: useUnifiedIgnoreProducts("cardnexus"),
  } satisfies Record<Marketplace, unknown>;
}

export function useAssignToCardByMarketplace() {
  return {
    tcgplayer: useUnifiedAssignToCard("tcgplayer"),
    cardmarket: useUnifiedAssignToCard("cardmarket"),
    cardtrader: useUnifiedAssignToCard("cardtrader"),
    cardnexus: useUnifiedAssignToCard("cardnexus"),
  } satisfies Record<Marketplace, unknown>;
}

export function useUnassignFromCardByMarketplace() {
  return {
    tcgplayer: useUnifiedUnassignFromCard("tcgplayer"),
    cardmarket: useUnifiedUnassignFromCard("cardmarket"),
    cardtrader: useUnifiedUnassignFromCard("cardtrader"),
    cardnexus: useUnifiedUnassignFromCard("cardnexus"),
  } satisfies Record<Marketplace, unknown>;
}
