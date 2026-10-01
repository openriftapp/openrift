import { errataContract } from "@openrift/shared/contracts/errata";
import type { ErrataListResponse } from "@openrift/shared/contracts/errata";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { errataKeys } from "@/features/cards/lib/cards-query-keys";
import { serverCache } from "@/lib/server-cache";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchErrataList = createServerFn({ method: "GET" }).handler((): Promise<ErrataListResponse> =>
  serverCache.query({
    queryKey: ["server-cache", "errata"],
    queryFn: () => apiOrpcClient(errataContract).list(),
  }),
);

export const errataListQueryOptions = queryOptions({
  queryKey: errataKeys.all,
  queryFn: () => fetchErrataList(),
  staleTime: 5 * 60 * 1000,
});
