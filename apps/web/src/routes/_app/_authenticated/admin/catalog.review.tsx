import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { RouteErrorFallback } from "@/components/error-message";
import { AdminPending } from "@/features/admin/components/admin-route-components";
import { reviewQueueQueryOptions } from "@/features/catalog-admin/hooks/use-catalog-review";
import { adminSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/admin/catalog/review")({
  head: () => adminSeoHead("Review"),
  validateSearch: z.object({
    filter: z.enum(["all", "contributors", "sources"]).optional(),
    q: z.string().optional(),
  }),
  loader: async ({ context }) => {
    await context.queryClient.query({ ...reviewQueueQueryOptions, staleTime: "static" });
  },
  pendingComponent: AdminPending,
  errorComponent: RouteErrorFallback,
});
