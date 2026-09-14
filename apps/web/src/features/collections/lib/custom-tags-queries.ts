import { adminCustomTagsContract } from "@openrift/shared/contracts/admin/custom-tags";
import type {
  CustomTagCategoryResponse,
  CustomTagResponse,
} from "@openrift/shared/types/api/admin";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

interface AdminCustomTagsResponse {
  tags: CustomTagResponse[];
}

interface AdminCustomTagCategoriesResponse {
  categories: CustomTagCategoryResponse[];
}

const fetchCustomTags = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<AdminCustomTagsResponse> =>
    apiOrpcClient(adminCustomTagsContract, context.cookie).listTags(),
  );

export const adminCustomTagsQueryOptions = queryOptions({
  queryKey: adminKeys.customTags,
  queryFn: () => fetchCustomTags(),
  staleTime: 30 * 60 * 1000,
});

const fetchCustomTagCategories = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<AdminCustomTagCategoriesResponse> =>
    apiOrpcClient(adminCustomTagsContract, context.cookie).listCategories(),
  );

export const adminCustomTagCategoriesQueryOptions = queryOptions({
  queryKey: adminKeys.customTagCategories,
  queryFn: () => fetchCustomTagCategories(),
  staleTime: 30 * 60 * 1000,
});
