import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { RouteErrorFallback } from "@/components/error-message";
import { AdminPending } from "@/features/admin/components/admin-route-components";
import { reviewQueueQueryOptions } from "@/features/admin/lib/catalog-review-queries";
import { providerSettingsQueryOptions } from "@/features/admin/lib/provider-settings-queries";
import { REVIEW_FILTERS } from "@/features/admin/lib/review-queue";
import { adminSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/admin/review")({
  head: () => adminSeoHead("Review"),
  validateSearch: z.object({
    filter: z.enum(REVIEW_FILTERS).optional(),
    q: z.string().optional(),
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
