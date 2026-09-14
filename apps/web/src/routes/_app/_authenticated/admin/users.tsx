import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { AdminPending } from "@/features/admin/components/admin-route-components";
import { adminDashboardQueryOptions } from "@/features/admin/lib/admin-dashboard-queries";
import { adminGrantsQueryOptions } from "@/features/admin/lib/admin-grants-queries";
import { adminUsersQueryOptions } from "@/features/admin/lib/admin-users-queries";
import { adminSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/admin/users")({
  head: () => adminSeoHead("Users"),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.query({ ...adminUsersQueryOptions, staleTime: "static" }),
      context.queryClient.query({ ...adminGrantsQueryOptions, staleTime: "static" }),
      context.queryClient.query({ ...adminDashboardQueryOptions, staleTime: "static" }),
    ]);
  },
  pendingComponent: AdminPending,
  errorComponent: RouteErrorFallback,
});
