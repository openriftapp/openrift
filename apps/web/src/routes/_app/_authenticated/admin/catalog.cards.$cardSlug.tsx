import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { RouteErrorFallback } from "@/components/error-message";
import { AdminPending } from "@/features/admin/components/admin-route-components";
import { adminCardDetailQueryOptions } from "@/features/admin/hooks/use-admin-card-queries";
import { providerSettingsQueryOptions } from "@/features/admin/hooks/use-provider-settings";
import { reviewQueueQueryOptions } from "@/features/catalog-admin/hooks/use-catalog-review";
import { CATALOG_TAB_VALUES } from "@/features/catalog-admin/lib/catalog-tabs";
import { adminSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/admin/catalog/cards/$cardSlug")({
  head: ({ params }) => adminSeoHead(params.cardSlug),
  validateSearch: z.object({
    tab: z.enum(CATALOG_TAB_VALUES).optional(),
    from: z.enum(["review"]).optional(),
    filter: z.enum(["all", "contributors", "sources"]).optional(),
    q: z.string().optional(),
  }),
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.query({
        ...adminCardDetailQueryOptions(params.cardSlug),
        staleTime: "static",
      }),
      context.queryClient.query({ ...providerSettingsQueryOptions, staleTime: "static" }),
      context.queryClient.query({ ...reviewQueueQueryOptions, staleTime: "static" }),
    ]);
  },
  pendingComponent: AdminPending,
  errorComponent: RouteErrorFallback,
});
