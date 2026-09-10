import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { AdminPending } from "@/features/admin/components/admin-route-components";
import { adminAccessQueryOptions } from "@/features/admin/hooks/use-admin";
import { catalogSourcesQueryOptions } from "@/features/catalog-admin/hooks/use-catalog-list";
import { adminSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/admin/catalog/sources")({
  head: () => adminSeoHead("Sources"),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.query({ ...catalogSourcesQueryOptions, staleTime: "static" }),
      context.queryClient.query({
        ...adminAccessQueryOptions(context.userId),
        staleTime: "static",
      }),
    ]);
  },
  pendingComponent: AdminPending,
  errorComponent: RouteErrorFallback,
});
