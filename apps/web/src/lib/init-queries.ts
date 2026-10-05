import { initContract } from "@openrift/shared/contracts/init";
import type { InitResponse } from "@openrift/shared/types/api/init";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { initKeys, serverCacheKeys } from "@/lib/query-keys";
import { serverCache } from "@/lib/server-cache";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

export function readInitFromServerCache(): Promise<InitResponse> {
  return serverCache.query({
    queryKey: serverCacheKeys.init,
    queryFn: () => apiOrpcClient(initContract).get(),
  });
}

const fetchInit = createServerFn({ method: "GET" }).handler(() => readInitFromServerCache());

export const initQueryOptions = queryOptions({
  queryKey: initKeys.all,
  queryFn: () => fetchInit(),
  staleTime: 5 * 60 * 1000,
  refetchOnWindowFocus: false,
});
