import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/mini";

import { RouteErrorFallback } from "@/components/error-message";
import { AdminPending } from "@/features/admin/components/admin-route-components";
import { REVIEW_FILTERS } from "@/features/admin/lib/admin-search-values";
import { reviewQueueQueryOptions } from "@/features/admin/lib/catalog-review-queries";
import { providerSettingsQueryOptions } from "@/features/admin/lib/provider-settings-queries";
import { lenient } from "@/lib/lenient-param";
import { adminSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/admin/review")({
  head: () => adminSeoHead("Review"),
  validateSearch: z.object({
    filter: lenient(z.enum(REVIEW_FILTERS)),
    q: lenient(z.string()),
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.query({ ...reviewQueueQueryOptions, staleTime: "static" }),
      context.queryClient.query({ ...providerSettingsQueryOptions, staleTime: "static" }),
    ]);
  },
  pendingComponent: AdminPending,
  errorComponent: RouteErrorFallback,
});
