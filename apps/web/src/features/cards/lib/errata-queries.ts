import { errataContract } from "@openrift/shared/contracts/errata";
import type { ErrataListResponse } from "@openrift/shared/contracts/errata";
import { MINUTE_MS } from "@openrift/shared/format-date";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { errataKeys } from "@/features/cards/lib/cards-query-keys";
import { serverCacheKeys } from "@/lib/query-keys";
import { serverCache } from "@/lib/server-cache";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchErrataList = createServerFn({ method: "GET" }).handler((): Promise<ErrataListResponse> =>
  serverCache.query({
    queryKey: serverCacheKeys.errata,
    queryFn: () => apiOrpcClient(errataContract).list(),
  }),
);

export const errataListQueryOptions = queryOptions({
  queryKey: errataKeys.all,
  queryFn: () => fetchErrataList(),
  staleTime: 5 * MINUTE_MS,
});
