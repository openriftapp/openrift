import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { AdminPending } from "@/features/admin/components/admin-route-components";
import { adminDistributionChannelsQueryOptions } from "@/features/admin/lib/distribution-channels-queries";
import { adminMarkersQueryOptions } from "@/features/admin/lib/markers-queries";
import { deskPrintingQueryOptions } from "@/features/admin/lib/printing-desk-queries";
import { initQueryOptions } from "@/lib/init-queries";
import { adminSeoHead } from "@/lib/seo";

export const Route = createFileRoute(
  "/_app/_authenticated/admin/printing-desk_/printings/$printingId",
)({
  head: () => adminSeoHead("Printing"),
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.query({
        ...deskPrintingQueryOptions(params.printingId),
        staleTime: "static",
      }),
      context.queryClient.query({
        ...adminDistributionChannelsQueryOptions,
        staleTime: "static",
      }),
      context.queryClient.query({ ...adminMarkersQueryOptions, staleTime: "static" }),
      context.queryClient.query({ ...initQueryOptions, staleTime: "static" }),
    ]);
  },
  pendingComponent: AdminPending,
  errorComponent: RouteErrorFallback,
});
