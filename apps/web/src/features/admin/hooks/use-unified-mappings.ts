import { adminIgnoredProductsContract } from "@openrift/shared/contracts/admin/ignored-products";
import { adminStagingCardOverridesContract } from "@openrift/shared/contracts/admin/staging-card-overrides";
import { adminUnifiedMappingsContract } from "@openrift/shared/contracts/admin/unified-mappings";
import type { Marketplace } from "@openrift/shared/types/pricing";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import {
  unifiedMappingsQueryOptions,
  unifiedMappingsSummaryQueryOptions,
} from "@/features/admin/lib/unified-mappings-queries";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import type { UnifiedMappingsSummaryResponse } from "@/lib/server-fns/api-types";
import { withCookies } from "@/lib/server-fns/middleware";
import type { ContractInput } from "@/lib/server-fns/orpc-client";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

export function useUnifiedMappings() {
  return useSuspenseQuery(unifiedMappingsQueryOptions());
}

/**
 * The marketplace endpoint 403s for card-review grant holders, so the query
 * only runs when `enabled` (full admin).
 */
function selectSummary(summary: UnifiedMappingsSummaryResponse) {
  return {
    assignBucketsBySlug: new Map(Object.entries(summary.assignBucketsBySlug)),
    unmatchedCount: summary.unmatchedCount,
  };
}

export function useUnifiedMappingsSummaryWhen(enabled: boolean) {
  return useQuery({ ...unifiedMappingsSummaryQueryOptions(), enabled, select: selectSummary });
}

function useUnifiedMutation<TInput, TResult>(
  marketplace: Marketplace,
  mutationFn: (input: TInput) => Promise<TResult>,
) {
  return useMutationWithInvalidation({
    mutationFn,
    invalidates: [adminKeys.unifiedMappings.all, adminKeys.marketplace(marketplace)],
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

export function useUnifiedSaveMappings(marketplace: Marketplace) {
  return useUnifiedMutation(marketplace, async (body: SaveMappingsBody) => {
    const result = await saveMappingsFn({
      data: { marketplace, mappings: body.mappings },
    });
    for (const skipped of result.skipped) {
      toast.error(`#${skipped.externalId}: ${skipped.reason}`);
    }
    return result;
  });
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
    marketplace,
    async (products: { externalId: number; finish: string; language: string | null }[]) => {
      await ignoreVariantsFn({ data: { marketplace, products } });
    },
  );
}

/** Level-2 ignore: deny an entire upstream product regardless of finish/language. */
export function useUnifiedIgnoreProducts(marketplace: Marketplace) {
  return useUnifiedMutation(marketplace, async (products: { externalId: number }[]) => {
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
    marketplace,
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
    marketplace,
    async (params: { externalId: number; finish: string; language: string | null }) => {
      await unassignFromCardFn({ data: { marketplace, ...params } });
    },
  );
}
