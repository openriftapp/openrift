import { adminKeywordsContract } from "@openrift/shared/contracts/admin/keywords";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { keywordStatsQueryOptions } from "@/features/admin/lib/keywords-queries";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { initKeys } from "@/lib/query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const STYLE_INVALIDATES = [adminKeys.keywordStats, initKeys.all] as const;

export function useKeywordStats() {
  return useSuspenseQuery(keywordStatsQueryOptions);
}

const recomputeKeywordsFn = createServerFn({ method: "POST" })
  .middleware([withCookies])
  .handler(({ context }) => apiOrpcClient(adminKeywordsContract, context.cookie).recompute());

export function useRecomputeKeywords() {
  return useMutationWithInvalidation({
    mutationFn: () => recomputeKeywordsFn(),
    invalidates: [adminKeys.keywordStats],
  });
}

const updateKeywordStyleFn = createServerFn({ method: "POST" })
  .validator(
    (input: {
      name: string;
      color: string;
      darkText: boolean;
      costKeyword: boolean;
      cardModifier: boolean;
    }) => input,
  )
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminKeywordsContract, context.cookie).updateStyle(data);
  });

export function useUpdateKeywordStyle() {
  return useMutationWithInvalidation({
    mutationFn: (params: {
      name: string;
      color: string;
      darkText: boolean;
      costKeyword: boolean;
      cardModifier: boolean;
    }) => updateKeywordStyleFn({ data: params }),
    invalidates: STYLE_INVALIDATES,
  });
}

const createKeywordStyleFn = createServerFn({ method: "POST" })
  .validator(
    (input: {
      name: string;
      color: string;
      darkText: boolean;
      costKeyword: boolean;
      cardModifier: boolean;
    }) => input,
  )
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminKeywordsContract, context.cookie).createStyle(data);
  });

export function useCreateKeywordStyle() {
  return useMutationWithInvalidation({
    mutationFn: (params: {
      name: string;
      color: string;
      darkText: boolean;
      costKeyword: boolean;
      cardModifier: boolean;
    }) => createKeywordStyleFn({ data: params }),
    invalidates: STYLE_INVALIDATES,
  });
}

const deleteKeywordStyleFn = createServerFn({ method: "POST" })
  .validator((input: { name: string }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminKeywordsContract, context.cookie).removeStyle({ name: data.name });
  });

export function useDeleteKeywordStyle() {
  return useMutationWithInvalidation({
    mutationFn: (name: string) => deleteKeywordStyleFn({ data: { name } }),
    invalidates: STYLE_INVALIDATES,
  });
}

const discoverTranslationsFn = createServerFn({ method: "POST" })
  .middleware([withCookies])
  .handler(({ context }) =>
    apiOrpcClient(adminKeywordsContract, context.cookie).discoverTranslations(),
  );

export function useDiscoverTranslations() {
  return useMutationWithInvalidation({
    mutationFn: () => discoverTranslationsFn(),
    invalidates: STYLE_INVALIDATES,
  });
}

const upsertTranslationFn = createServerFn({ method: "POST" })
  .validator((input: { keywordName: string; language: string; label: string }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminKeywordsContract, context.cookie).upsertTranslation(data);
  });

export function useUpsertTranslation() {
  return useMutationWithInvalidation({
    mutationFn: (params: { keywordName: string; language: string; label: string }) =>
      upsertTranslationFn({ data: params }),
    invalidates: STYLE_INVALIDATES,
  });
}

const deleteTranslationFn = createServerFn({ method: "POST" })
  .validator((input: { keywordName: string; language: string }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminKeywordsContract, context.cookie).removeTranslation(data);
  });

export function useDeleteTranslation() {
  return useMutationWithInvalidation({
    mutationFn: (params: { keywordName: string; language: string }) =>
      deleteTranslationFn({ data: params }),
    invalidates: STYLE_INVALIDATES,
  });
}
