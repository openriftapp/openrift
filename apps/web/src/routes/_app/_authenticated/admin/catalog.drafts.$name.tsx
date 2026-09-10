import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { RouteErrorFallback } from "@/components/error-message";
import { AdminPending } from "@/features/admin/components/admin-route-components";
import {
  allCardsQueryOptions,
  unmatchedCardDetailQueryOptions,
} from "@/features/admin/hooks/use-admin-card-queries";
import { providerSettingsQueryOptions } from "@/features/admin/hooks/use-provider-settings";
import { reviewQueueQueryOptions } from "@/features/catalog-admin/hooks/use-catalog-review";
import { adminSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/admin/catalog/drafts/$name")({
  head: ({ params }) => adminSeoHead(params.name),
  validateSearch: z.object({
    from: z.enum(["review"]).optional(),
    filter: z.enum(["all", "contributors", "sources"]).optional(),
    q: z.string().optional(),
  }),
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.query({
        ...unmatchedCardDetailQueryOptions(params.name),
        staleTime: "static",
      }),
      context.queryClient.query({ ...providerSettingsQueryOptions, staleTime: "static" }),
      context.queryClient.query({ ...allCardsQueryOptions, staleTime: "static" }),
      context.queryClient.query({ ...reviewQueueQueryOptions, staleTime: "static" }),
    ]);
  },
  pendingComponent: AdminPending,
  errorComponent: RouteErrorFallback,
});
