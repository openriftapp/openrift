import { adminProductsContract } from "@openrift/shared/contracts/admin/products";
import { MINUTE_MS } from "@openrift/shared/format-date";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchProductPrintingIds = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<{ printingIds: string[] }> =>
    apiOrpcClient(adminProductsContract, context.cookie).printingIds(),
  );

export const adminProductPrintingIdsQueryOptions = queryOptions({
  queryKey: adminKeys.productPrintingIds,
  queryFn: () => fetchProductPrintingIds(),
  staleTime: 5 * MINUTE_MS,
});
