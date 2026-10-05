import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { AdminPending } from "@/features/admin/components/admin-route-components";
import { adminAccessQueryOptions } from "@/features/admin/lib/admin-queries";
import { adminDistributionChannelsQueryOptions } from "@/features/admin/lib/distribution-channels-queries";
import { adminMarkersQueryOptions } from "@/features/admin/lib/markers-queries";
import { deskPrintingsQueryOptions } from "@/features/admin/lib/printing-desk-queries";
import { catalogQueryOptions } from "@/features/cards/lib/catalog-queries";
import { initQueryOptions } from "@/lib/init-queries";
import { adminSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/admin/printing-desk")({
  head: () => adminSeoHead("Your printings"),
  loader: async ({ context }) => {
    const access = await context.queryClient.query({
      ...adminAccessQueryOptions(context.userId),
      staleTime: "static",
    });
    await Promise.all([
      context.queryClient.query({
        ...deskPrintingsQueryOptions(access.isAdmin ? "all" : "mine"),
        staleTime: "static",
      }),
      context.queryClient.query({
        ...adminDistributionChannelsQueryOptions,
        staleTime: "static",
      }),
      context.queryClient.query({ ...adminMarkersQueryOptions, staleTime: "static" }),
      context.queryClient.query({ ...initQueryOptions, staleTime: "static" }),
      // The "New printing" dialog searches the catalog cache, so it must be warm first.
      context.queryClient.query({ ...catalogQueryOptions, staleTime: "static" }),
    ]);
  },
  pendingComponent: AdminPending,
  errorComponent: RouteErrorFallback,
});
