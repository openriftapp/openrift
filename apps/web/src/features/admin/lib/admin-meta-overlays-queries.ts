import { adminMetaCandidatesContract } from "@openrift/shared/contracts/admin/meta";
import type { MetaOverlayQueueRow } from "@openrift/shared/types/api/meta";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchMetaOverlays = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<{ overlays: MetaOverlayQueueRow[] }> =>
    apiOrpcClient(adminMetaCandidatesContract, context.cookie).list(),
  );

export const adminMetaOverlaysQueryOptions = queryOptions({
  queryKey: adminKeys.meta.overlays,
  queryFn: () => fetchMetaOverlays(),
  staleTime: 5 * 60 * 1000,
});
