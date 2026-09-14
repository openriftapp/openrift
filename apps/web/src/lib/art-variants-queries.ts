import type { AdminArtVariantsResponse } from "@openrift/shared/contracts/admin/art-variants";
import { adminArtVariantsContract } from "@openrift/shared/contracts/admin/art-variants";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchArtVariants = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<AdminArtVariantsResponse> =>
    apiOrpcClient(adminArtVariantsContract, context.cookie).list(),
  );

export const adminArtVariantsQueryOptions = queryOptions({
  queryKey: adminKeys.artVariants,
  queryFn: () => fetchArtVariants(),
});
