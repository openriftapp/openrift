import { adminCardTagsContract } from "@openrift/shared/contracts/admin/card-tags";
import type { MutationMeta } from "@tanstack/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import {
  adminCardTagsQueryOptions,
  adminTagCategoriesQueryOptions,
  adminTagTranslationsQueryOptions,
} from "@/features/cards/lib/card-tags-queries";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { initKeys } from "@/lib/query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

export function useCardTags() {
  return useSuspenseQuery(adminCardTagsQueryOptions);
}

export function useTagCategoryList() {
  return useSuspenseQuery(adminTagCategoriesQueryOptions);
}

const createTagCategoryFn = createServerFn({ method: "POST" })
  .validator((input: { slug: string; label: string; description?: string | null }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminCardTagsContract, context.cookie).createCategory(data);
  });

export function useCreateTagCategory(meta?: MutationMeta) {
  return useMutationWithInvalidation({
    meta,
    mutationFn: (vars: { slug: string; label: string; description?: string | null }) =>
      createTagCategoryFn({ data: vars }),
    invalidates: [adminKeys.tagCategories, adminKeys.cardTags, initKeys.all],
  });
}

const updateTagCategoryFn = createServerFn({ method: "POST" })
  .validator(
    (input: { id: string; slug?: string; label?: string; description?: string | null }) => input,
  )
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminCardTagsContract, context.cookie).updateCategory(data);
  });

export function useUpdateTagCategory(meta?: MutationMeta) {
  return useMutationWithInvalidation({
    meta,
    mutationFn: (vars: {
      id: string;
      slug?: string;
      label?: string;
      description?: string | null;
    }) => updateTagCategoryFn({ data: vars }),
    invalidates: [adminKeys.tagCategories, adminKeys.cardTags, initKeys.all],
  });
}

const deleteTagCategoryFn = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminCardTagsContract, context.cookie).removeCategory({ id: data.id });
  });

export function useDeleteTagCategory() {
  return useMutationWithInvalidation({
    mutationFn: (id: string) => deleteTagCategoryFn({ data: { id } }),
    invalidates: [adminKeys.tagCategories, adminKeys.cardTags, initKeys.all],
  });
}

const setTagCategoryFn = createServerFn({ method: "POST" })
  .validator((input: { tag: string; categoryId: string | null }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminCardTagsContract, context.cookie).setTagCategory(data);
  });

export function useSetTagCategory() {
  return useMutationWithInvalidation({
    mutationFn: (vars: { tag: string; categoryId: string | null }) =>
      setTagCategoryFn({ data: vars }),
    // The init invalidation only refreshes this admin's own client cache; the
    // edge-cached /init means other visitors pick the change up within ~1h.
    invalidates: [adminKeys.cardTags, adminKeys.tagCategories, initKeys.all],
  });
}

interface DetectLegendTagsResponse {
  found: number;
  assigned: number;
}

const detectLegendTagsFn = createServerFn({ method: "POST" })
  .validator((input: { categoryId: string }) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<DetectLegendTagsResponse> =>
    apiOrpcClient(adminCardTagsContract, context.cookie).detectLegendTags(data),
  );

export function useDetectLegendTags() {
  return useMutationWithInvalidation({
    mutationFn: (vars: { categoryId: string }) => detectLegendTagsFn({ data: vars }),
    invalidates: [adminKeys.cardTags, adminKeys.tagCategories, initKeys.all],
  });
}

export function useTagTranslations() {
  return useSuspenseQuery(adminTagTranslationsQueryOptions);
}

const TRANSLATION_INVALIDATES = [
  adminKeys.tagTranslations,
  adminKeys.workspace,
  adminKeys.cards.all,
] as const;

const setTagTranslationFn = createServerFn({ method: "POST" })
  .validator((input: { tag: string; language: string; label: string }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminCardTagsContract, context.cookie).setTranslation(data);
  });

export function useSetTagTranslation() {
  return useMutationWithInvalidation({
    mutationFn: (vars: { tag: string; language: string; label: string }) =>
      setTagTranslationFn({ data: vars }),
    invalidates: [...TRANSLATION_INVALIDATES],
  });
}

const removeTagTranslationFn = createServerFn({ method: "POST" })
  .validator((input: { language: string; label: string }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminCardTagsContract, context.cookie).removeTranslation(data);
  });

export function useRemoveTagTranslation() {
  return useMutationWithInvalidation({
    mutationFn: (vars: { language: string; label: string }) =>
      removeTagTranslationFn({ data: vars }),
    invalidates: [...TRANSLATION_INVALIDATES],
  });
}

const discoverTagTranslationsFn = createServerFn({ method: "POST" })
  .middleware([withCookies])
  .handler(({ context }) =>
    apiOrpcClient(adminCardTagsContract, context.cookie).discoverTranslations(),
  );

export function useDiscoverTagTranslations() {
  return useMutationWithInvalidation({
    mutationFn: () => discoverTagTranslationsFn(),
    invalidates: [...TRANSLATION_INVALIDATES],
  });
}
