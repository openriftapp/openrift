import { customTagsContract } from "@openrift/shared/contracts/custom-tags";
import type { CustomTagsResponse } from "@openrift/shared/types/api/custom-tags";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { customTagsKeys } from "@/features/cards/lib/cards-query-keys";
import { serverCacheKeys } from "@/lib/query-keys";
import { serverCache } from "@/lib/server-cache";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

function readCustomTagsFromServerCache(): Promise<CustomTagsResponse> {
  return serverCache.query({
    queryKey: serverCacheKeys.customTags,
    queryFn: () => apiOrpcClient(customTagsContract).get(),
  });
}

const fetchCustomTags = createServerFn({ method: "GET" }).handler(() =>
  readCustomTagsFromServerCache(),
);

export const customTagsQueryOptions = queryOptions({
  queryKey: customTagsKeys.all,
  queryFn: () => fetchCustomTags(),
  staleTime: 5 * 60 * 1000,
  refetchOnWindowFocus: false,
});
