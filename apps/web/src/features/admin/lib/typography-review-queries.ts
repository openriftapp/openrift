import type { TypographyReviewResponse } from "@openrift/shared/contracts/admin/typography-review";
import { adminTypographyReviewContract } from "@openrift/shared/contracts/admin/typography-review";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchTypographyReview = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<TypographyReviewResponse> =>
    apiOrpcClient(adminTypographyReviewContract, context.cookie).list(),
  );

export const typographyReviewQueryOptions = queryOptions({
  queryKey: adminKeys.typographyReview,
  queryFn: () => fetchTypographyReview(),
});
