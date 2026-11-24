import { adminCardTagsContract } from "@openrift/shared/contracts/admin/card-tags";
import { MINUTE_MS } from "@openrift/shared/format-date";
import type { ClassifiedCardTag, TagCategoryResponse } from "@openrift/shared/types/api/admin";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

interface AdminCardTagsResponse {
  tags: ClassifiedCardTag[];
}

interface AdminTagCategoriesResponse {
  categories: TagCategoryResponse[];
}

const fetchCardTags = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<AdminCardTagsResponse> =>
    apiOrpcClient(adminCardTagsContract, context.cookie).listTags(),
  );

export const adminCardTagsQueryOptions = queryOptions({
  queryKey: adminKeys.cardTags,
  queryFn: () => fetchCardTags(),
  staleTime: 30 * MINUTE_MS,
});

const fetchTagCategories = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<AdminTagCategoriesResponse> =>
    apiOrpcClient(adminCardTagsContract, context.cookie).listCategories(),
  );

export const adminTagCategoriesQueryOptions = queryOptions({
  queryKey: adminKeys.tagCategories,
  queryFn: () => fetchTagCategories(),
  staleTime: 30 * MINUTE_MS,
});

const fetchTagTranslations = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }) =>
    apiOrpcClient(adminCardTagsContract, context.cookie).listTranslations(),
  );

export const adminTagTranslationsQueryOptions = queryOptions({
  queryKey: adminKeys.tagTranslations,
  queryFn: () => fetchTagTranslations(),
  staleTime: 30 * MINUTE_MS,
});
