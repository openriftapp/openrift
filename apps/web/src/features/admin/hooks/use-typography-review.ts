import type { AcceptTypographyFixBody } from "@openrift/shared/contracts/admin/typography-review";
import { adminTypographyReviewContract } from "@openrift/shared/contracts/admin/typography-review";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { typographyReviewQueryOptions } from "@/features/admin/lib/typography-review-queries";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";
import { useMutationWithInvalidation } from "@/lib/use-mutation-with-invalidation";

export function useTypographyReview() {
  return useSuspenseQuery(typographyReviewQueryOptions);
}

const acceptTypographyFixFn = createServerFn({ method: "POST" })
  .validator((input: AcceptTypographyFixBody) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminTypographyReviewContract, context.cookie).accept(data);
  });

export function useAcceptTypographyFix() {
  return useMutationWithInvalidation<void, AcceptTypographyFixBody>({
    mutationFn: async (variables) => {
      await acceptTypographyFixFn({ data: variables });
    },
    invalidates: [adminKeys.typographyReview],
  });
}
